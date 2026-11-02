"""
Router-based URL configuration for the API.

Using DRF's DefaultRouter gives us, per registered viewset:
    GET    /resource/          list
    POST   /resource/          create
    GET    /resource/{id}/     retrieve
    PUT    /resource/{id}/     update
    PATCH  /resource/{id}/     partial update
    DELETE /resource/{id}/     destroy

Plus custom @action endpoints, like /theses/{id}/set-status/.
"""
from django.urls import path

from rest_framework.routers import DefaultRouter

from .auth_views import CsrfView, LoginView, LogoutView
from .views import ChapterViewSet, CommentViewSet, MeViewSet, ThesisViewSet
from .views import ChapterViewSet, CommentViewSet, MeViewSet, ThesisViewSet, NotificationViewSet

router = DefaultRouter()
router.register(r"theses",   ThesisViewSet,  basename="thesis")
router.register(r"chapters", ChapterViewSet, basename="chapter")
router.register(r"comments", CommentViewSet, basename="comment")
router.register(r"notifications", NotificationViewSet, basename="notification")
router.register(r"me",       MeViewSet,      basename="me")

urlpatterns = [
    path("auth/csrf/",   CsrfView.as_view(),   name="auth-csrf"),
    path("auth/login/",  LoginView.as_view(),  name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    *router.urls,
]