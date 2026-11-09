"""
Seed script for the PAC Thesis Tracking System.

Usage:
    python manage.py seed_demo         # creates demo data
    python manage.py seed_demo --flush # deletes existing demo data first
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from api.models import User, Thesis, Chapter, Comment, Department


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
            Comment.objects.all().delete()
            Chapter.objects.all().delete()
            Thesis.objects.all().delete()
            User.objects.filter(is_superuser=False).delete()

        # Get the departments we created earlier
        cs_dept = Department.objects.get(name="Department of Computing & Information Technology")
        business_dept = Department.objects.get(name="Department of Business Studies")
        theology_dept = Department.objects.get(name="Department of Biblical & Theological Studies")

        self.stdout.write("Creating supervisors...")
        supervisors = []
        sup_data = [
            ("dkamau", "Dr. David Kamau", theology_dept),
            ("machieng", "Prof. Mary Achieng", business_dept),
            ("jmutua", "Dr. John Mutua", cs_dept),
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
            ("bmwangi", "Brian Mwangi", cs_dept),
            ("awanjiku", "Alice Wanjiku", business_dept),
            ("ckiptoo", "Charles Kiptoo", theology_dept),
            ("goduor", "Grace Oduor", cs_dept),
            ("pndungu", "Peter Ndungu", business_dept),
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
                    "registration_number": f"PAC/{dept.name[:2].upper()}/{username[-3:].upper()}",
                }
            )
            if created:
                stu.set_password("password123")
                stu.save()
            students.append(stu)

        # ... (the rest of the file for creating theses and chapters remains the same, 
        # but make sure to pass `department=student.department` when creating the Thesis)