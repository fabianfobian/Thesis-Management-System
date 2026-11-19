"""
One-time seed script for testing.
Creates HODs, Deans, Supervisors, and Students with proposals.
Run: python manage.py seed_test_users
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group
from django.db import transaction
from api.models import User, Thesis, Chapter, School, Department


class Command(BaseCommand):
    help = "Seeds test users (HODs, Deans, Supervisors, Students) with proposals."

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write("🌱 Starting seed...")

        # ---------------------------------------------------------------
        # 1. Ensure the Groups exist
        # ---------------------------------------------------------------
        dean_group, _ = Group.objects.get_or_create(name="Dean")
        hod_group, _ = Group.objects.get_or_create(name="HOD")
        self.stdout.write("✅ Groups ensured (Dean, HOD)")

        # ---------------------------------------------------------------
        # 2. Fetch Schools and Departments
        # ---------------------------------------------------------------
        schools = {s.name: s for s in School.objects.all()}
        departments = {d.name: d for d in Department.objects.all()}

        if not schools or not departments:
            self.stdout.write(self.style.ERROR(
                "❌ No schools/departments found. Run 'python manage.py setup_pac_structure' first."
            ))
            return

        # ---------------------------------------------------------------
        # 3. Create Deans (1 per school)
        # ---------------------------------------------------------------
        deans_data = [
            ("dean_theology", "Dr. Grace Wanjiru", "School of Theology"),
            ("dean_business", "Prof. Samuel Otieno", "School of Leadership, Business & Technology"),
            ("dean_humanities", "Dr. Ruth Njeri", "School of Humanities & Social Sciences"),
        ]

        for username, full_name, school_name in deans_data:
            school = schools.get(school_name)
            if not school:
                continue
            first, last = full_name.split(" ", 1)
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "email": f"{username}@pac.ac.ke",
                    "first_name": first,
                    "last_name": last,
                    "role": User.Role.ADMIN,
                    "department": school.departments.first(),
                },
            )
            if created:
                user.set_password("password123")
                user.save()
            user.groups.add(dean_group)
            self.stdout.write(f"  -> Dean: {username} ({school_name})")

        # ---------------------------------------------------------------
        # 4. Create HODs (1 per department)
        # ---------------------------------------------------------------
        hod_data = [
            ("hod_biblical", "Dr. Peter Mwangi", "Biblical & Theological Studies"),
            ("hod_tcl", "Rev. John Kariuki", "Transformational Church Leadership (TCL)"),
            ("hod_children", "Dr. Mary Wambui", "Children and Youth Ministry"),
            ("hod_leadership", "Dr. James Ochieng", "Leadership Studies"),
            ("hod_business", "Prof. Agnes Nyambura", "Business Studies"),
            ("hod_computing", "Dr. Kevin Mutua", "Computing & Information Technology"),
            ("hod_psychology", "Dr. Lucy Atieno", "Psychology"),
            ("hod_communication", "Dr. Brian Wekesa", "Communication, Languages & Linguistics"),
            ("hod_community", "Dr. Faith Chebet", "Community Development"),
        ]

        for username, full_name, dept_name in hod_data:
            dept = departments.get(dept_name)
            if not dept:
                continue
            first, last = full_name.split(" ", 1)
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "email": f"{username}@pac.ac.ke",
                    "first_name": first,
                    "last_name": last,
                    "role": User.Role.ADMIN,
                    "department": dept,
                },
            )
            if created:
                user.set_password("password123")
                user.save()
            user.groups.add(hod_group)
            self.stdout.write(f"  -> HOD: {username} ({dept_name})")

        # ---------------------------------------------------------------
        # 5. Create Supervisors (12 spread across departments)
        # ---------------------------------------------------------------
        sup_data = [
            ("sup_david", "Dr. David Kimani", "Biblical & Theological Studies"),
            ("sup_esther", "Dr. Esther Njoki", "Biblical & Theological Studies"),
            ("sup_paul", "Prof. Paul Onyango", "Transformational Church Leadership (TCL)"),
            ("sup_mercy", "Dr. Mercy Wanjala", "Children and Youth Ministry"),
            ("sup_george", "Dr. George Odhiambo", "Leadership Studies"),
            ("sup_anne", "Prof. Anne Mutinda", "Business Studies"),
            ("sup_josphat", "Dr. Josphat Karanja", "Business Studies"),
            ("sup_alice", "Dr. Alice Njoroge", "Computing & Information Technology"),
            ("sup_charles", "Dr. Charles Kipchoge", "Computing & Information Technology"),
            ("sup_lilian", "Dr. Lilian Achieng", "Psychology"),
            ("sup_benard", "Dr. Benard Otieno", "Communication, Languages & Linguistics"),
            ("sup_carol", "Dr. Carol Wairimu", "Community Development"),
        ]

        for username, full_name, dept_name in sup_data:
            dept = departments.get(dept_name)
            if not dept:
                continue
            first, last = full_name.split(" ", 1)
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "email": f"{username}@pac.ac.ke",
                    "first_name": first,
                    "last_name": last,
                    "role": User.Role.SUPERVISOR,
                    "department": dept,
                },
            )
            if created:
                user.set_password("password123")
                user.save()
            self.stdout.write(f"  -> Supervisor: {username} ({dept_name})")

        # ---------------------------------------------------------------
        # 6. Create Students (15 spread across departments)
        # ---------------------------------------------------------------
        stu_data = [
            ("stu_brian", "Brian Mwangi", "Computing & Information Technology", "proposal"),
            ("stu_wanjiku", "Alice Wanjiku", "Business Studies", "in_progress"),
            ("stu_kiptoo", "Charles Kiptoo", "Biblical & Theological Studies", "rejected"),
            ("stu_grace", "Grace Oduor", "Computing & Information Technology", "proposal"),
            ("stu_peter", "Peter Ndungu", "Business Studies", "in_progress"),
            ("stu_jane", "Jane Doe", "Psychology", "proposal"),
            ("stu_mary", "Mary Wairimu", "Psychology", "in_progress"),
            ("stu_kevin", "Kevin Omondi", "Leadership Studies", "proposal"),
            ("stu_faith", "Faith Achieng", "Communication, Languages & Linguistics", "in_progress"),
            ("stu_daniel", "Daniel Kiprop", "Community Development", "rejected"),
            ("stu_lucy", "Lucy Mwende", "Children and Youth Ministry", "proposal"),
            ("stu_joseph", "Joseph Kamau", "Transformational Church Leadership (TCL)", "in_progress"),
            ("stu_esther", "Esther Njoki", "Computing & Information Technology", "proposal"),
            ("stu_samuel", "Samuel Otieno", "Business Studies", "in_progress"),
            ("stu_sarah", "Sarah Mutindi", "Psychology", "proposal"),
        ]

        thesis_titles = [
            "Digital Transformation in Kenyan Churches",
            "Microfinance Impact on Rural Poverty",
            "Ethical Implications of AI in Healthcare",
            "Mental Health Awareness in Kenyan Schools",
            "Sustainable Community Development in Nairobi",
            "The Role of Youth in Church Leadership",
            "Data Privacy in Kenyan Fintech Companies",
            "Women Entrepreneurship in Urban Kenya",
            "Theology of Stewardship in Modern Context",
            "Cybersecurity Threats in Public Universities",
            "Impact of Social Media on Teenagers",
            "Agricultural Innovation and Food Security",
            "Modern Worship Practices in Pentecostal Churches",
            "Youth Unemployment Strategies in Kenya",
            "Digital Literacy for Rural Communities",
        ]

        for i, (username, full_name, dept_name, status) in enumerate(stu_data):
            dept = departments.get(dept_name)
            if not dept:
                continue
            first, last = full_name.split(" ", 1)
            student, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "email": f"{username}@student.pac.ac.ke",
                    "first_name": first,
                    "last_name": last,
                    "role": User.Role.STUDENT,
                    "department": dept,
                    "registration_number": f"PAC/{dept.name[:3].upper()}/{i+1:03d}",
                },
            )
            if created:
                student.set_password("password123")
                student.save()

            # Assign a supervisor from the same department
            supervisor = User.objects.filter(
                role=User.Role.SUPERVISOR, department=dept
            ).first()

            thesis, thesis_created = Thesis.objects.get_or_create(
                student=student,
                defaults={
                    "title": thesis_titles[i],
                    "abstract": f"A comprehensive study on {thesis_titles[i].lower()} with a focus on the Kenyan context.",
                    "department": dept,
                    "status": status,
                    "supervisor": supervisor,
                },
            )

            # If in_progress, create chapters
            if thesis_created and status == "in_progress":
                Chapter.objects.create(
                    thesis=thesis, number=1, title="Introduction",
                    status=Chapter.Status.APPROVED,
                )
                Chapter.objects.create(
                    thesis=thesis, number=2, title="Literature Review",
                    status=Chapter.Status.SUBMITTED,
                )

            # If rejected, add a reason
            if thesis_created and status == "rejected":
                thesis.rejection_reason = "Topic is too broad. Please narrow down the research scope."
                thesis.save()

            self.stdout.write(f"  -> Student: {username} ({status})")

        self.stdout.write(self.style.SUCCESS("🎉 Seed complete! All passwords are 'password123'"))