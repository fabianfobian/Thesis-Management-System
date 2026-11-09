from django.core.management.base import BaseCommand
from api.models import School, Department

class Command(BaseCommand):
    help = "Populates the database with PAC University's Schools and Departments."

    def handle(self, *args, **kwargs):
        self.stdout.write("Setting up PAC University structure...")

        # 1. Define the hierarchy
        pac_data = {
            "School of Theology": [
                "Biblical & Theological Studies",
                "Transformational Church Leadership (TCL)",
                "Children and Youth Ministry",
            ],
            "School of Leadership, Business & Technology": [
                "Leadership Studies",
                "Business Studies",
                "Computing & Information Technology",
            ],
            "School of Humanities & Social Sciences": [
                "Psychology",
                "Communication, Languages & Linguistics",
                "Community Development",
            ],
        }

        # 2. Loop through and create them
        for school_name, departments in pac_data.items():
            school, created = School.objects.get_or_create(name=school_name)
            if created:
                self.stdout.write(self.style.SUCCESS(f"Created School: {school_name}"))
            
            for dept_name in departments:
                dept, created = Department.objects.get_or_create(
                    name=dept_name,
                    school=school
                )
                if created:
                    self.stdout.write(f"  -> Created Department: {dept_name}")

        self.stdout.write(self.style.SUCCESS("Successfully built the PAC University structure!"))