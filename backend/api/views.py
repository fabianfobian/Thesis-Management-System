"""
API viewsets for the PAC Thesis Tracking System.
"""

from django.db.models import Prefetch
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.contrib.auth.models import Group
from .models import (
    Chapter, 
    Comment, 
    Thesis, 
    User,
    Notification,
    Department,
)
from .permissions import (
    IsThesisParticipant,
    IsSupervisorOrAdmin,
    IsSuperuser,
)
from .serializers import (
    ChapterSerializer,
    CommentSerializer,
    ThesisSerializer,
    UserSerializer,
    ChapterVersionSerializer,
    NotificationSerializer,
    GroupSerializer, 
    DepartmentSerializer,
)
from .services.plagiarism import PlagiarismService # <-- ADDED IMPORT

# ---------------------------------------------------------------------------
# Theses
# ---------------------------------------------------------------------------

class ThesisViewSet(viewsets.ModelViewSet):
    """
    CRUD for theses.
    """
    serializer_class = ThesisSerializer
    permission_classes = [permissions.IsAuthenticated, IsThesisParticipant]

    def get_queryset(self):
        user = self.request.user
        base = (
            Thesis.objects
            .select_related("student", "supervisor", "co_supervisor", "third_reader")
            .prefetch_related(
                Prefetch(
                    "chapters",
                    queryset=Chapter.objects.prefetch_related("comments__author"),
                )
            )
        )
        if user.role == User.Role.ADMIN:
            return base
        if user.role == User.Role.SUPERVISOR:
            return base.filter(supervisor=user) | base.filter(co_supervisor=user) | base.filter(third_reader=user)
        return base.filter(student=user)

    def perform_create(self, serializer):
        user = self.request.user
        if user.role == User.Role.STUDENT:
            serializer.save(student=user)
        else:
            serializer.save()

    def perform_update(self, serializer):
        user = self.request.user
        if user.role == User.Role.STUDENT:
            thesis = self.get_object()
            serializer.save(
                supervisor=thesis.supervisor,
                co_supervisor=thesis.co_supervisor,
                third_reader=thesis.third_reader
            )
        else:
            serializer.save()

    @action(detail=True, methods=["post"], url_path="set-status", parser_classes=[MultiPartParser, FormParser])
    def set_status(self, request, pk=None):
        thesis = self.get_object()
        if request.user.role not in (User.Role.SUPERVISOR, User.Role.ADMIN):
            return Response({"detail": "Only supervisors can change status."}, status=403)

        new_status = request.data.get("status")
        valid_statuses = {s.value for s in Thesis.Status}
        if new_status not in valid_statuses:
            return Response(
                {"detail": f"Invalid status. Choose from {sorted(valid_statuses)}."},
                status=400,
            )

        thesis.status = new_status
        thesis.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(thesis).data)

    @action(detail=True, methods=["post"], url_path="assign-committee")
    def assign_committee(self, request, pk=None):
        if request.user.role != User.Role.ADMIN:
            return Response({"detail": "Only administrators can assign committee members."}, status=403)

        thesis = self.get_object()
        sup_id = request.data.get("supervisor_id")
        co_sup_id = request.data.get("co_supervisor_id")
        reader_id = request.data.get("third_reader_id")

        try:
            if sup_id:
                thesis.supervisor = User.objects.get(id=sup_id, role=User.Role.SUPERVISOR)
            if co_sup_id:
                thesis.co_supervisor = User.objects.get(id=co_sup_id, role=User.Role.SUPERVISOR)
            if reader_id:
                thesis.third_reader = User.objects.get(id=reader_id, role=User.Role.SUPERVISOR)
            
            thesis.save()
            return Response(self.get_serializer(thesis).data)
        except User.DoesNotExist:
            return Response({"detail": "One or more selected users are invalid."}, status=400)

    @action(detail=True, methods=["post"], url_path="review-proposal")
    def review_proposal(self, request, pk=None):
        """
        HOD endpoint to approve or reject a thesis proposal.
        """
        thesis = self.get_object()
        user = request.user

        # Only Superusers (HOD/ICT) can review proposals
        if not user.is_superuser:
            return Response({"detail": "Only HODs can review proposals."}, status=403)

        action = request.data.get("action") # "approve" or "reject"
        reason = request.data.get("reason", "")

        if action == "reject":
            thesis.status = Thesis.Status.REJECTED # Or create a specific "REJECTED" status
            thesis.rejection_reason = reason
            thesis.save()
            return Response({"detail": "Proposal rejected. Student notified."})
            
        elif action == "approve":
            thesis.status = Thesis.Status.IN_PROGRESS
            thesis.rejection_reason = None # Clear any previous rejection
            thesis.save()
            return Response({"detail": "Proposal approved. You can now assign the committee."})
            
        return Response({"detail": "Invalid action."}, status=400)

# ---------------------------------------------------------------------------
# Chapters
# ---------------------------------------------------------------------------

class ChapterViewSet(viewsets.ModelViewSet):
    """
    Chapters belong to a thesis; access is inherited from the parent thesis.
    """
    serializer_class = ChapterSerializer
    permission_classes = [permissions.IsAuthenticated, IsThesisParticipant]

    def get_queryset(self):
        user = self.request.user
        base = (
            Chapter.objects
            .select_related("thesis", "thesis__student", "thesis__supervisor", "thesis__co_supervisor", "thesis__third_reader")
            .prefetch_related("comments__author", "versions")
        )
        if user.role == User.Role.ADMIN:
            return base
        if user.role == User.Role.SUPERVISOR:
            return base.filter(thesis__supervisor=user) | base.filter(thesis__co_supervisor=user) | base.filter(thesis__third_reader=user)
        return base.filter(thesis__student=user)

    def perform_create(self, serializer):
        thesis = serializer.validated_data["thesis"]
        user = self.request.user
        is_admin = user.role == User.Role.ADMIN
        is_participant = (
            user == thesis.student or 
            user == thesis.supervisor or 
            user == thesis.co_supervisor or 
            user == thesis.third_reader
        )
        if not (is_admin or is_participant):
            raise permissions.PermissionDenied("You cannot add chapters to this thesis.")
        serializer.save()

    @action(
        detail=True, 
        methods=["post"], 
        url_path="upload-version", 
        parser_classes=[MultiPartParser, FormParser],
        permission_classes=[permissions.IsAuthenticated]
    )
    def upload_version(self, request, pk=None):
        from .models import ChapterVersion
        from .serializers import ChapterVersionSerializer
        from .services.plagiarism import PlagiarismService 
        import io

        # --- Text extraction helpers ---
        def extract_text_from_file(file_obj, ext):
            text = ""
            try:
                if ext == "pdf":
                    from pypdf import PdfReader
                    reader = PdfReader(file_obj)
                    for page in reader.pages:
                        text += page.extract_text() or ""
                elif ext == "docx":
                    import docx
                    doc = docx.Document(file_obj)
                    text = "\n".join([p.text for p in doc.paragraphs])
                elif ext == "txt":
                    text = file_obj.read().decode("utf-8", errors="ignore")
            except Exception as e:
                print("Extraction error:", e)
            return text

        chapter = self.get_object()
                
        if request.user != chapter.thesis.student:
            return Response({"detail": "Only the student can upload files."}, status=403)

        file_obj = request.FILES.get("document")
        if not file_obj:
            return Response({"detail": "No file provided."}, status=400)

        # 1. Extract text BEFORE saving to S3 (the file pointer moves!)
        ext = file_obj.name.split(".")[-1].lower()
        extracted_text = extract_text_from_file(file_obj, ext)
        file_obj.seek(0) # Reset pointer so it can be saved to S3


        latest = chapter.versions.first()
        next_version = (latest.version_number + 1) if latest else 1

        version = ChapterVersion.objects.create(
            chapter=chapter,
            version_number=next_version,
            document=file_obj,
        )
        
        chapter.status = Chapter.Status.SUBMITTED
        chapter.save()

        # Auto-trigger Plagiarism Check
        if extracted_text:
            result = PlagiarismService.check_text(extracted_text)
            chapter.plagiarism_score = result["score"]
            chapter.plagiarism_report = result["report"]
            chapter.plagiarism_status = result["status"]
            chapter.save()

        return Response(ChapterVersionSerializer(version).data, status=201)

    # MOVED HERE: Plagiarism check action
    @action(detail=True, methods=["post"], url_path="check-plagiarism")
    def check_plagiarism(self, request, pk=None):
        """
        Triggers a plagiarism check on the chapter's extracted text.
        """
        chapter = self.get_object()
        text = request.data.get("text")
        
        if not text:
            return Response({"detail": "No text provided for checking."}, status=400)

        chapter.plagiarism_status = "checking"
        chapter.save()

        # Call the service
        result = PlagiarismService.check_text(text)

        # Save the result
        chapter.plagiarism_score = result["score"]
        chapter.plagiarism_report = result["report"]
        chapter.plagiarism_status = result["status"]
        chapter.save()

        return Response(self.get_serializer(chapter).data)


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------

class CommentViewSet(viewsets.ModelViewSet):
    """
    Append-only comment threads on chapters.
    """
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticated, IsThesisParticipant]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        base = Comment.objects.select_related(
            "author", "chapter", "chapter__thesis",
            "chapter__thesis__student", "chapter__thesis__supervisor",
        )
        if user.role == User.Role.ADMIN:
            return base
        if user.role == User.Role.SUPERVISOR:
            return base.filter(chapter__thesis__supervisor=user) | base.filter(chapter__thesis__co_supervisor=user) | base.filter(chapter__thesis__third_reader=user)
        return base.filter(chapter__thesis__student=user)

    def perform_create(self, serializer):
        chapter = serializer.validated_data["chapter"]
        thesis = chapter.thesis
        user = self.request.user
        if user.role == User.Role.STUDENT:
            # Automatically assign the department from the user's profile
            serializer.save(student=user, department=user.department)
        else:
            serializer.save()



# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

class NotificationViewSet(viewsets.ModelViewSet):
    """
    Fetch and manage notifications for the logged-in user.
    """
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)

    @action(detail=True, methods=["patch"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response(self.get_serializer(notification).data)

    @action(detail=False, methods=["patch"], url_path="mark-all-read")
    def mark_all_read(self, request):
        Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({"status": "all marked as read"})


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

class MeViewSet(viewsets.ViewSet):
    """
    GET /api/me/ -> returns the authenticated user.
    """
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        return Response(UserSerializer(request.user).data)

class GroupViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Returns the list of custom roles (e.g., Dean, HOD) created by the ICT team.
    """
    queryset = Group.objects.all()
    serializer_class = GroupSerializer
    permission_classes = [permissions.IsAuthenticated, IsSuperuser]

class DepartmentViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Returns the list of PAC departments.
    """
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [permissions.IsAuthenticated]

class UserViewSet(viewsets.ModelViewSet):
    """
    CRUD for users. Only Superusers can create or edit users.
    """
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated, IsSuperuser]

    def get_queryset(self):
        return User.objects.all().order_by("first_name")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Grab the generated password and add it to the response JSON
        response_data = serializer.data
        response_data["generated_password"] = getattr(user, "_generated_password", None)

        return Response(response_data, status=201)