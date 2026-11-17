from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Comment, Notification, Thesis
from django.core.mail import send_mail
from django.conf import settings

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
        
        if author == thesis.supervisor:
            recipient = thesis.student
        elif author == thesis.student:
            recipient = thesis.supervisor
        else:
            return

        if recipient:
            # 1. In-app notification
            Notification.objects.create(
                recipient=recipient,
                message=f"New feedback on {chapter.title} from {author.get_full_name() or author.username}",
                link=f"/theses/{thesis.id}"
            )
            
            # 2. Email notification
            if recipient.email:
                try:
                    send_mail(
                        subject=f"New Feedback on {chapter.title}",
                        message=f"Hello {recipient.get_full_name() or recipient.username},\n\n{author.get_full_name() or author.username} has left feedback on your thesis.\n\nLog in to view it: https://thesis-management-system-pi.vercel.app/theses/{thesis.id}",
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[recipient.email],
                        fail_silently=True,
                    )
                except Exception as e:
                    print(f"Email failed: {e}")