"""
API viewsets for the PAC Thesis Tracking System.

Authorization model
-------------------
Every viewset filters its queryset by role BEFORE serialization. That means
a student listing `/api/theses/` receives only their own thesis in the JSON
array — other theses are not merely forbidden, they are invisible. This
avoids leaking existence of records via 403 vs 404 differences.

Additional write restrictions (e.g. "only supervisors may change status")
are enforced via dedicated endpoints or `perform_*` hooks.
"""

from django.db.models import Prefetch
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

from .models import (
    Chapter, 
    Comment, 
    Thesis, 
    User,
    Notification,
)
from .permissions import (
    IsThesisParticipant,
    IsSupervisorOrAdmin,
)
from .serializers import (
    ChapterSerializer,
    CommentSerializer,
    ThesisSerializer,
    UserSerializer,
    ChapterVersionSerializer,
    NotificationSerializer,
)


# ---------------------------------------------------------------------------
# Theses
# ---------------------------------------------------------------------------

class ThesisViewSet(viewsets.ModelViewSet):
    """
    CRUD for theses.

    Visibility:
        admin       -> all theses
        supervisor  -> theses they supervise
        student     -> only their own thesis
    """

    serializer_class = ThesisSerializer
    permission_classes = [permissions.IsAuthenticated, IsThesisParticipant]

    def get_queryset(self):
        """
        Base queryset + role filter.

        We `select_related` student and supervisor so nested serialization
        doesn't N+1, and `prefetch_related` chapters + comments because the
        serializer nests them.
        """
        user = self.request.user

        base = (
            Thesis.objects
            .select_related("student", "supervisor")
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
            return base.filter(supervisor=user)
        return base.filter(student=user)

    def perform_create(self, serializer):
        """
        A student may only create their own thesis. Admins can create on
        behalf of a student by passing `student_id` in the payload.
        """
        user = self.request.user
        if user.role == User.Role.STUDENT:
            serializer.save(student=user)
        else:
            serializer.save()

    def perform_update(self, serializer):
        """
        Students may edit only their own thesis fields (title, abstract).

        Reassigning the supervisor is an admin operation: if a student tries
        to slip `supervisor_id` into the payload, we silently drop it.
        """
        user = self.request.user
        if user.role == User.Role.STUDENT:
            # Keep the existing committee, don't let students change it
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
        """
        Move a thesis through its workflow.

        Only supervisors and admins may call this. Students see the new
        status but cannot set it themselves.
        """
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
        """
        Admin-only endpoint to assign the 3 supervisors.
        """
        if request.user.role != User.Role.ADMIN:
            return Response({"detail": "Only administrators can assign committee members."}, status=403)

        thesis = self.get_object()
        
        # Get the IDs from the request
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


# ---------------------------------------------------------------------------
# Chapters
# ---------------------------------------------------------------------------

class ChapterViewSet(viewsets.ModelViewSet):
    """
    Chapters belong to a thesis; access is inherited from the parent thesis.

    Note: chapter creation must include `thesis` in the payload. We do NOT
    verify in the serializer that the caller has access to that thesis —
    that would require a second query. Instead, permissions on the resulting
    object will 403 if the caller isn't a participant. To be tighter, we
    could add an explicit check in `perform_create`; I've added one below
    since chapter uploads are the sensitive operation here.
    """

    serializer_class = ChapterSerializer
    permission_classes = [permissions.IsAuthenticated, IsThesisParticipant]

    def get_queryset(self):
        user = self.request.user

        base = (
            Chapter.objects
            .select_related("thesis", "thesis__student", "thesis__supervisor")
            .prefetch_related("comments__author")
        )

        if user.role == User.Role.ADMIN:
            return base
        if user.role == User.Role.SUPERVISOR:
            return base.filter(thesis__supervisor=user)
        return base.filter(thesis__student=user)

    def perform_create(self, serializer):
        """
        A chapter may only be added to a thesis the caller participates in.

        We check here because the permission class runs AFTER creation —
        too late for a foreign thesis id smuggling in.
        """
        thesis = serializer.validated_data["thesis"]
        user = self.request.user

        is_admin = user.role == User.Role.ADMIN
        is_participant = user == thesis.student or user == thesis.supervisor

        if not (is_admin or is_participant):
            raise permissions.PermissionDenied(
                "You cannot add chapters to this thesis."
            )

        serializer.save()
    @action(
        detail=True, 
        methods=["post"], 
        url_path="upload-version", 
        parser_classes=[MultiPartParser, FormParser],
        permission_classes=[permissions.IsAuthenticated]
    )
    def upload_version(self, request, pk=None):
        """Upload a new version of a chapter file."""
        from .models import ChapterVersion
        from .serializers import ChapterVersionSerializer

        chapter = self.get_object()
                
        if request.user != chapter.thesis.student:
            return Response({"detail": "Only the student can upload files."}, status=403)

        file_obj = request.FILES.get("document")
        if not file_obj:
            return Response({"detail": "No file provided."}, status=400)

        latest = chapter.versions.first()
        next_version = (latest.version_number + 1) if latest else 1

        version = ChapterVersion.objects.create(
            chapter=chapter,
            version_number=next_version,
            document=file_obj,
        )
        
        chapter.status = Chapter.Status.SUBMITTED
        chapter.save()

        return Response(ChapterVersionSerializer(version).data, status=201)

# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------

class CommentViewSet(viewsets.ModelViewSet):
    """
    Append-only comment threads on chapters.

    We disable PUT/PATCH/DELETE via `http_method_names` because comments
    are part of the academic record — corrections should be new comments,
    not silent edits.
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
            return base.filter(chapter__thesis__supervisor=user)
        return base.filter(chapter__thesis__student=user)

    def perform_create(self, serializer):
        """
        Author is always the caller. Also verify the caller participates
        in the thesis the chapter belongs to (same reasoning as chapters).
        """
        chapter = serializer.validated_data["chapter"]
        thesis = chapter.thesis
        user = self.request.user

        is_admin = user.role == User.Role.ADMIN
        is_participant = user == thesis.student or user == thesis.supervisor

        if not (is_admin or is_participant):
            raise permissions.PermissionDenied(
                "You cannot comment on this thesis."
            )

        serializer.save(author=user)

#----------------------------------------------------------
# Notification
#-----------------------------------------------------------

class NotificationViewSet(viewsets.ModelViewSet):
    """
    Fetch and manage notifications for the logged-in user.
    """
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"] # Allow GET and PATCH

    def get_queryset(self):
        # A user can only see their own notifications
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
# "Who am I" — used by the frontend after login
# ---------------------------------------------------------------------------

class MeViewSet(viewsets.ViewSet):
    """
    GET /api/me/ -> returns the authenticated user.

    The frontend calls this on page load to decide which navigation
    (student / supervisor / admin) to render.
    """

    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        return Response(UserSerializer(request.user).data)

class UserViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only list of users. Used by the admin to pick supervisors.
    """
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated, IsSupervisorOrAdmin]

    def get_queryset(self):
        # Only return supervisors so the admin can pick them
        return User.objects.filter(role=User.Role.SUPERVISOR).order_by("first_name")