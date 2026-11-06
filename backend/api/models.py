"""
DOmain models

Design notes
-------------
* single custom User model caries a role field. Roles are explcit 
  rather than hidden behind Django Groups, this is to make authorization rules 
  readable in querysets and permission classes.
* `thesis` is the central aggregate. Chapter and comment cascade from it
* All workflow states are TextChoices so bachend and front end share a 
  stable vocabulary.
"""
"""
Domain models for the PAC University Thesis Tracking System.

Design notes
------------
* A single custom User model carries a `role` field. Roles are explicit
  rather than hidden behind Django Groups, which makes authorization rules
  readable in querysets and permission classes.
* `Thesis` is the central aggregate. `Chapter` and `Comment` cascade from it.
* All workflow states are `TextChoices` so backend and frontend share a
  stable vocabulary.
"""

from django.contrib.auth.models import AbstractUser
from django.core.validators import FileExtensionValidator
from django.db import models


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
class User(AbstractUser):
    """
    Application user with an explicit role.

    Extends AbstractUser (not AbstractBaseUser) so we keep Django's
    username/password/permissions machinery out of the box.
    """

    class Role(models.TextChoices):
        STUDENT = "student", "Student"
        SUPERVISOR = "supervisor", "Supervisor"
        ADMIN = "admin", "Administrator"

    # Email must be unique — used for notifications and password resets.
    email = models.EmailField(unique=True)

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.STUDENT,
        help_text="Determines which parts of the system the user can access.",
    )

    registration_number = models.CharField(
        max_length=32,
        blank=True,
        help_text="Student registration number or staff ID.",
    )

    department = models.CharField(max_length=120, blank=True)

    def __str__(self) -> str:
        return f"{self.get_full_name() or self.username} ({self.role})"


# ---------------------------------------------------------------------------
# Thesis
# ---------------------------------------------------------------------------
class Thesis(models.Model):
    """
    A single thesis/dissertation project owned by one student.

    The 'one active thesis per student' rule is enforced in the serializer,
    not at the DB level, because admins may need to keep archived records.
    """

    class Status(models.TextChoices):
        PROPOSAL = "proposal", "Proposal submitted"
        IN_PROGRESS = "in_progress", "In progress"
        UNDER_REVIEW = "under_review", "Under review"
        REVISIONS = "revisions", "Revisions required"
        APPROVED = "approved", "Approved"
        DEFENDED = "defended", "Defended"
        ARCHIVED = "archived", "Archived"

    student = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="theses",
        limit_choices_to={"role": User.Role.STUDENT},
    )
    supervisor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="supervised_theses",
        limit_choices_to={"role": User.Role.SUPERVISOR},
        verbose_name="Main Supervisor"
    )

    # NEW FIELDS for the committee
    co_supervisor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="co_supervised_theses",
        limit_choices_to={"role": User.Role.SUPERVISOR},
        verbose_name="Co-Supervisor"
    )

    third_reader = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="third_reader_theses",
        limit_choices_to={"role": User.Role.SUPERVISOR},
        verbose_name="Third Reader"
    )

    title = models.CharField(max_length=300)
    abstract = models.TextField(blank=True)
    department = models.CharField(max_length=120, blank=True)

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PROPOSAL,
    )

    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        verbose_name_plural = "Theses"

    def __str__(self) -> str:
        return f"{self.title} — {self.student}"


# ---------------------------------------------------------------------------
# Chapter
# ---------------------------------------------------------------------------
class Chapter(models.Model):
    """
    A single chapter belonging to a thesis (e.g. Chapter 1: Introduction).

    Each chapter carries its own review state because supervisors typically
    approve chapters independently before the full document is ready.
    """

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SUBMITTED = "submitted", "Submitted for review"
        UNDER_REVIEW = "under_review", "Under review"
        REVISIONS = "revisions", "Revisions required"
        APPROVED = "approved", "Approved"

    thesis = models.ForeignKey(
        Thesis,
        on_delete=models.CASCADE,
        related_name="chapters",
    )

    number = models.PositiveSmallIntegerField(
        help_text="Chapter number, e.g. 1 for 'Introduction'.",
    )
    title = models.CharField(max_length=200)
    content = models.TextField(blank=True)

    
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )

    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Plagiarism fields
    plagiarism_score = models.FloatField(null=True, blank=True, help_text="Percentage similarity")
    plagiarism_status = models.CharField(
        max_length=20,
        choices=[("pending", "Pending"), ("checking", "Checking"), ("checked", "Checked"), ("failed", "Failed")],
        default="pending"
    )
    plagiarism_report = models.JSONField(null=True, blank=True, help_text="Full JSON report from the API")
    
    class Meta:
        unique_together = ("thesis", "number")
        ordering = ["thesis", "number"]

    def __str__(self) -> str:
        return f"Ch. {self.number}: {self.title}"

# ---------------------------------------------------------------------------
# Chapter Versioning
# ---------------------------------------------------------------------------

class ChapterVersion(models.Model):
    """
    Represents a specific uploaded file version for a chapter.
    Allows supervisors to see revision history.
    """
    chapter = models.ForeignKey(Chapter, on_delete=models.CASCADE, related_name="versions")
    version_number = models.PositiveIntegerField()
    document = models.FileField(
        upload_to="chapters/%Y/%m/",
        validators=[FileExtensionValidator(allowed_extensions=["pdf", "doc", "docx"])]
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("chapter", "version_number")
        ordering = ["-version_number"]

    def __str__(self):
        return f"{self.chapter} - v{self.version_number}"

# ---------------------------------------------------------------------------
# Comment
# ---------------------------------------------------------------------------
class Comment(models.Model):
    """
    Feedback thread between a supervisor and a student on a specific chapter.

    Comments are append-only by policy; edits are discouraged in academic
    record keeping. If a comment is wrong, post a correction instead.
    """

    chapter = models.ForeignKey(
        Chapter,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    body = models.TextField()

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"Comment by {self.author} on {self.chapter}"
# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

class Notification(models.Model):
    """
    In-app notifications for users.
    Triggered automatically via Django signals when events occur 
    (e.g., a supervisor leaves a comment).
    """
    recipient = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name="notifications"
    )
    # The URL the user should go to when clicking the notification
    link = models.CharField(max_length=255, blank=True)
    message = models.CharField(max_length=255)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Notification for {self.recipient}: {self.message}"