from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Comment, Notification

@receiver(post_save, sender=Comment)
def create_comment_notification(sender, instance, created, **kwargs):
    """
    When a new comment is created:
    If a supervisor comments on a student's thesis, notify the student.
    If a student comments, notify the supervisor.
    (We only trigger on creation, not updates).
    """
    if created:
        chapter = instance.chapter
        thesis = chapter.thesis
        author = instance.author
        
        # Determine who should receive the notification
        if author == thesis.supervisor:
            recipient = thesis.student
        elif author == thesis.student:
            recipient = thesis.supervisor
        else:
            return # If an admin comments, don't notify anyone for now

        if recipient:
            Notification.objects.create(
                recipient=recipient,
                message=f"New feedback on {chapter.title} from {author.get_full_name() or author.username}",
                link=f"/theses/{thesis.id}"
            )