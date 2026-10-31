"""
DRF serializers for the PAC Thesis Tracking API.

Conventions
-----------
* Read-only fields (ids, timestamps, nested author objects) are declared
  explicitly to prevent accidental client-side writes.
* Anything mutable across models (e.g. assigning a supervisor) is exposed
  as a write-only PK field (`supervisor_id`) alongside a read-only
  nested representation (`supervisor`). This keeps responses rich
  without forcing clients to send nested objects.
* Cross-model validation (e.g. "one active thesis per student") lives in
  `validate()` methods so it runs whether the object is created via the
  API or the admin.
"""

from rest_framework import serializers

from .models import Chapter, Comment, Thesis, User, ChapterVersion


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

class UserSerializer(serializers.ModelSerializer):
    """
    Compact user projection embedded inside other resources.

    Kept intentionally small — we never want to leak password hashes or
    permission flags to the frontend. Anything a client needs to render a
    thesis card (name, role, department) is here.
    """

    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "full_name",
            "role",
            "department",
        ]
        read_only_fields = fields  # populated by the system, not the client

    def get_full_name(self, obj: User) -> str:
        """Prefer the person's real name; fall back to username."""
        return obj.get_full_name() or obj.username


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------

class CommentSerializer(serializers.ModelSerializer):
    """
    A comment on a chapter.

    `author` is populated from `request.user` in the viewset — clients never
    send it, which makes impersonation impossible.
    """

    author = UserSerializer(read_only=True)

    class Meta:
        model = Comment
        fields = ["id", "chapter", "author", "body", "created_at"]
        read_only_fields = ["id", "author", "created_at"]


# ---------------------------------------------------------------------------
# Chapter Version Serializer MUST be defined before ChapterSerializer
# ---------------------------------------------------------------------------
class ChapterVersionSerializer(serializers.ModelSerializer):
    document_url = serializers.SerializerMethodField()

    class Meta:
        model = ChapterVersion
        fields = ["id", "version_number", "document", "document_url", "uploaded_at"]
        read_only_fields = ["id", "version_number", "uploaded_at"]

    def get_document_url(self, obj):
        if not obj.document:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.document.url) if request else obj.document.url



# ---------------------------------------------------------------------------
# Chapters
# ---------------------------------------------------------------------------

class ChapterSerializer(serializers.ModelSerializer):
    """
    A chapter belonging to a thesis.
    """
    comments = CommentSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    
    # NEW: Ensure the file URL is absolute (includes http://localhost:8000)
    #document_url = serializers.SerializerMethodField()
    versions = ChapterVersionSerializer(many=True, read_only=True)
    class Meta:
        model = Chapter
        fields = [
            "id",
            "thesis",
            "number",
            "title",
            "content",
            #"document",
            #"document_url", 
            "versions",
            "status",
            "status_display",
            "comments",
            "submitted_at",
            "updated_at",
        ]
        read_only_fields = ["id", "submitted_at", "updated_at"]

    def get_document_url(self, obj: Chapter) -> str | None:
        if not obj.document:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.document.url)
        return obj.document.url

# ---------------------------------------------------------------------------
# Theses
# ---------------------------------------------------------------------------

class ThesisSerializer(serializers.ModelSerializer):
    """
    The central resource. A thesis belongs to one student and (usually)
    one supervisor.

    Read side: nested student/supervisor objects for rich rendering.
    Write side: `student_id` / `supervisor_id` primary keys.
    """

    # --- Read-only projections (never accepted from the client) ---
    student = UserSerializer(read_only=True)
    supervisor = UserSerializer(read_only=True)
    chapters = ChapterSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    # --- Write-only PK fields (client sends these when creating/updating) ---
    student_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=User.Role.STUDENT),
        source="student",
        write_only=True,
        required=False,
    )
    supervisor_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=User.Role.SUPERVISOR),
        source="supervisor",
        write_only=True,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Thesis
        fields = [
            "id",
            "title",
            "abstract",
            "department",
            "status",
            "status_display",
            "student",
            "student_id",
            "supervisor",
            "supervisor_id",
            "chapters",
            "submitted_at",
            "updated_at",
        ]
        read_only_fields = ["id", "submitted_at", "updated_at"]

    def validate(self, attrs):
        """
        Enforce the business rule: a student may only have one non-archived
        thesis at a time.

        On update, exclude the current instance so it doesn't count itself.
        """
        student = attrs.get("student") or getattr(self.instance, "student", None)
        if student is not None:
            conflicting = Thesis.objects.filter(student=student).exclude(
                status=Thesis.Status.ARCHIVED
            )
            if self.instance is not None:
                conflicting = conflicting.exclude(pk=self.instance.pk)
            if conflicting.exists():
                raise serializers.ValidationError(
                    {"student_id": "This student already has an active thesis."}
                )
        return attrs