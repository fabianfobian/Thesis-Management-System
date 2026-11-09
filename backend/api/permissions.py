"""
Object-level permission classes.

These are a SECOND layer of defense. The FIRST layer is queryset filtering
in the viewsets — a student who somehow guesses another student's thesis id
will get a 404, not a 403, because the object never enters their queryset.

Permissions here handle the cases querysets can't express, like:
    * "only supervisors/admins may change a thesis status"
    * "only the author may delete their own comment" (we disable deletes
      entirely for comments, but the pattern generalizes)
"""

from rest_framework import permissions

from .models import User


class IsAdmin(permissions.BasePermission):
    """Allow access only to users with the ADMIN role."""

    message = "Administrator access required."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role == User.Role.ADMIN
        )


class IsSupervisorOrAdmin(permissions.BasePermission):
    """Allow access only to supervisors and admins."""

    message = "Supervisor or administrator access required."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role in (User.Role.SUPERVISOR, User.Role.ADMIN)
        )


class IsThesisParticipant(permissions.BasePermission):
    """
    Object-level check used by Thesis, Chapter, and Comment views.

    A participant is any of:
        * the student who owns the thesis
        * the supervisor assigned to the thesis
        * any administrator

    `obj` may be a Thesis or a Chapter or a Comment; we walk to the thesis
    for chapters and comments.
    """

    message = "You do not have access to this thesis."

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user.is_authenticated:
            return False
        if user.role == User.Role.ADMIN:
            return True

        # Resolve the owning thesis regardless of the object type.
        if hasattr(obj, "student"):          # Thesis
            thesis = obj
        elif hasattr(obj, "thesis"):         # Chapter
            thesis = obj.thesis
        else:                                 # Comment
            thesis = obj.chapter.thesis

        return user == thesis.student or user == thesis.supervisor

class IsSuperuser(permissions.BasePermission):
    """
    Allows access only to superusers (the ICT team).
    This is used for administrative endpoints that should not be
    accessible to Deans or HODs.
    """
    message = "Only the ICT Superuser team can perform this action."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)