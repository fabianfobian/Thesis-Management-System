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

from .models import Chapter, Comment, Thesis, User
from .permissions import IsThesisParticipant
from .serializers import (
    ChapterSerializer,
    CommentSerializer,
    ThesisSerializer,
    UserSerializer,
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
            serializer.save(supervisor=self.get_object().supervisor)
        else:
            serializer.save()

    @action(detail=True, methods=["post"], url_path="set-status")
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