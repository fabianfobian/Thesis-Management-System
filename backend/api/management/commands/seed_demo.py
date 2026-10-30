"""
Seed script for the PAC Thesis Tracking System.

Usage:
    python manage.py seed_demo         # creates demo data
    python manage.py seed_demo --flush # deletes existing demo data first
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from api.models import User, Thesis, Chapter, Comment


class Command(BaseCommand):
    help = "Populates the database with demo students, supervisors, and theses."

    def add_arguments(self, parser):
        parser.add_argument(
            "--flush",
            action="store_true",
            help="Delete all existing data (except superusers) before seeding.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options["flush"]:
            self.stdout.write(self.style.WARNING("Flushing existing data..."))
            # Delete everything except superusers
            Comment.objects.all().delete()
            Chapter.objects.all().delete()
            Thesis.objects.all().delete()
            User.objects.filter(is_superuser=False).delete()

        self.stdout.write("Creating supervisors...")
        supervisors = []
        sup_data = [
            ("dkamau", "Dr. David Kamau", "Theology"),
            ("machieng", "Prof. Mary Achieng", "Business"),
            ("jmutua", "Dr. John Mutua", "Computer Science"),
        ]
        for username, name, dept in sup_data:
            first, last = name.split(" ", 1)
            sup, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "email": f"{username}@pac.ac.ke",
                    "first_name": first,
                    "last_name": last,
                    "role": User.Role.SUPERVISOR,
                    "department": dept,
                }
            )
            if created:
                sup.set_password("password123")
                sup.save()
            supervisors.append(sup)

        self.stdout.write("Creating students...")
        students = []
        stu_data = [
            ("bmwangi", "Brian Mwangi", "Computer Science"),
            ("awanjiku", "Alice Wanjiku", "Business"),
            ("ckiptoo", "Charles Kiptoo", "Theology"),
            ("goduor", "Grace Oduor", "Computer Science"),
            ("pndungu", "Peter Ndungu", "Business"),
        ]
        for username, name, dept in stu_data:
            first, last = name.split(" ", 1)
            stu, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "email": f"{username}@student.pac.ac.ke",
                    "first_name": first,
                    "last_name": last,
                    "role": User.Role.STUDENT,
                    "department": dept,
                    "registration_number": f"PAC/{dept[:2]}/{username[-3:].upper()}",
                }
            )
            if created:
                stu.set_password("password123")
                stu.save()
            students.append(stu)

        self.stdout.write("Creating theses and chapters...")
        thesis_topics = [
            "The Role of Digital Discipleship in Kenyan Urban Churches",
            "Microfinance as a Tool for Poverty Alleviation in Nairobi",
            "Ethical Implications of AI in Modern Healthcare",
            "Impact of Social Media on Teenage Mental Health",
            "Theological Foundations of Environmental Stewardship",
            "Modernizing Legacy Systems in the Public Sector",
            "Effects of Remote Work on Employee Productivity",
            "Youth Unemployment and Entrepreneurship in Kenya",
            "A Critique of Modern Pentecostal Worship Practices",
            "Cybersecurity Challenges in Financial Technology",
        ]

        # Create a thesis for each student, looping through topics
        for i, student in enumerate(students):
            supervisor = supervisors[i % len(supervisors)]
            topic = thesis_topics[i]
            
            thesis = Thesis.objects.create(
                student=student,
                supervisor=supervisor,
                title=topic,
                abstract=f"This thesis explores {topic.lower()} with a focus on the Kenyan context.",
                department=student.department,
                status=Thesis.Status.IN_PROGRESS if i % 2 == 0 else Thesis.Status.PROPOSAL,
            )

            # Create Chapters 1 and 2 for each thesis
            ch1 = Chapter.objects.create(
                thesis=thesis,
                number=1,
                title="Introduction",
                status=Chapter.Status.APPROVED,
                content="This chapter introduces the background of the study..."
            )
            ch2 = Chapter.objects.create(
                thesis=thesis,
                number=2,
                title="Literature Review",
                status=Chapter.Status.SUBMITTED,
                content="This chapter reviews existing literature on the topic..."
            )

            # Add a comment from the supervisor on Chapter 1
            Comment.objects.create(
                chapter=ch1,
                author=supervisor,
                body="Excellent introduction. Please ensure all citations are in APA 7th edition format."
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully seeded {len(students)} students, "
                f"{len(supervisors)} supervisors, and {len(students)} theses."
            )
        )
        self.stdout.write(
            self.style.SUCCESS("All demo users have the password: 'password123'")
        )