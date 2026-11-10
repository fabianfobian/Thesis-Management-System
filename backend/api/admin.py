"""
Django admin registrations.

The admin is the fastest way to seed data during development. We extend
the default UserAdmin so our custom fields (role, department) show up.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import Chapter, Comment, Thesis, User,Notification, School, Department


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ("username", "email", "role", "department", "is_staff")
    list_filter = ("role", "department", "is_staff")
    fieldsets = DjangoUserAdmin.fieldsets + (
        ("PAC Profile", {"fields": ("role", "registration_number", "department")}),
    )


@admin.register(Thesis)
class ThesisAdmin(admin.ModelAdmin):
    list_display = ("title", "student", "supervisor", "status", "updated_at")
    list_filter = ("status", "department")
    search_fields = ("title", "student__username", "student__email")


@admin.register(Chapter)
class ChapterAdmin(admin.ModelAdmin):
    list_display = ("thesis", "number", "title", "status", "updated_at")
    list_filter = ("status",)


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("chapter", "author", "created_at")

@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display = ("name",)

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("name", "school")
    list_filter = ("school",)