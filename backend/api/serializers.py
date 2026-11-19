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
from django.contrib.auth.models import Group
from rest_framework import serializers
import secrets
import string

from .models import (
    Chapter, 
    Comment, 
    Thesis, 
    User, 
    ChapterVersion, 
    Notification,
    Department,
)
#----------------------------------------------------
# Group and department
#------------------------------------------------------

class GroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ["id", "name"]

class DepartmentSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source="school.name", read_only=True)
    class Meta:
        model = Department
        fields = ["id", "name", "school_name"]

# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

class UserSerializer(serializers.ModelSerializer):
    """
    Handles serialization for the User model.
    - Used for listing, creating, and updating users.
    - Never leaks password hashes.
    - Allows profile updates (first name, email, etc.).
    """
    
    full_name = serializers.SerializerMethodField()
    department_details = serializers.SerializerMethodField()
    groups = serializers.SerializerMethodField()
    
    password = serializers.CharField(
        write_only=True, 
        required=False,
    )

    # Allow writing department by ID (e.g., {"department_id": 3})
    department_id = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(),
        source="department",
        write_only=True,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "role",
            "department",
            "department_id",
            "department_details",
            "groups",
            "is_superuser",
            "registration_number", 
            "phone_number",
            "password",
        ]
        read_only_fields = [
            "id", 
            "full_name", 
            "is_superuser",
            "department",
            "groups",
        ]
        """
        extra_kwargs = {
            # The department is returned as an ID or object, but written via department_id
            "department": {"read_only": True},
        }
        """

    def get_full_name(self, obj: User) -> str:
        """Prefer the person's real name; fall back to username."""
        return obj.get_full_name() or obj.username

    def get_department_details(self, obj: User):
        if not obj.department:
            return None
        return {
            "name": obj.department.name,
            "school": obj.department.school.name if obj.department.school else None,
        }

    def get_groups(self, obj: User):
        return [g.name for g in obj.groups.all()]
        
    def create(self, validated_data):
        # Generate a secure password if not provided
        password = validated_data.pop("password", None)
        if not password:
            alphabet = string.ascii_letters + string.digits
            random_string = ''.join(secrets.choice(alphabet) for i in range(6))
            password = f"PAC-{random_string}"

        user = User(**validated_data)
        user.set_password(password)
        user.save()

        # Attach for the response (UserViewSet will pick this up)
        user._generated_password = password
        return user

    def update(self, instance, validated_data):
        # If updating the password, hash it properly
        password = validated_data.pop("password", None)
        if password:
            instance.set_password(password)

        # Update the rest of the fields normally
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        return instance


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
        fields = [
            "id", 
            "chapter",
            "version", 
            "author", 
            "body", 
            "created_at",
        ]
        read_only_fields = [
            "id", 
            "author", 
            "created_at",
        ]


# ---------------------------------------------------------------------------
# Chapter Version Serializer MUST be defined before ChapterSerializer
# ---------------------------------------------------------------------------
class ChapterVersionSerializer(serializers.ModelSerializer):
    document_url = serializers.SerializerMethodField()

    class Meta:
        model = ChapterVersion
        fields = [
            "id", 
            "version_number", 
            "document", 
            "document_url", 
            "uploaded_at",
            "comments",
        ]
        read_only_fields = [
            "id", 
            "version_number", 
            "uploaded_at"
        ]

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
            "deadline",
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

    #  Read-only nested representations
    co_supervisor = UserSerializer(read_only=True)
    third_reader = UserSerializer(read_only=True)

    #  Write-only IDs for updates
    co_supervisor_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=User.Role.SUPERVISOR),
        source="co_supervisor", write_only=True, required=False, allow_null=True,
    )
    third_reader_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=User.Role.SUPERVISOR),
        source="third_reader", write_only=True, required=False, allow_null=True,
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
            "rejection_reason",
            "student",
            "student_id",
            "supervisor",
            "supervisor_id",
            "co_supervisor", 
            "co_supervisor_id",
            "third_reader", 
            "third_reader_id",
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


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "message", "link", "is_read", "created_at"]
        read_only_fields = fields

