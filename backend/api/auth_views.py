"""
Session-based authentication endpoints.

Why these exist
---------------
DRF's SessionAuthentication needs three things the frontend can't do
on its own:

1. Obtain a CSRF token before any POST (the `csrftoken` cookie).
2. Perform a username/password login against Django's session backend.
3. Log out safely by clearing the session.

Using Django's built-in `login`/`logout` guarantees we stay compatible
with the admin site — one login covers everything.
"""

from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
from rest_framework import status, permissions
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

from .serializers import UserSerializer

class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        old_password = request.data.get("old_password")
        new_password = request.data.get("new_password")

        if not user.check_password(old_password):
            return Response({"detail": "Current password is incorrect."}, status=400)

        try:
            # Enforce Django's password rules (length, symbols, etc.)
            validate_password(new_password, user)
        except ValidationError as e:
            return Response({"detail": e.messages[0]}, status=400)

        user.set_password(new_password)
        user.save()
        
        # Keep the user logged in after the password change
        update_session_auth_hash(request, user)
        
        return Response({"detail": "Password changed successfully."})

@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    """
    GET /api/auth/csrf/

    Triggers Django to set the `csrftoken` cookie on the response.
    The frontend reads this cookie and echoes it back via the
    `X-CSRFToken` header on all state-changing requests.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"csrfToken": get_token(request)})


class LoginView(APIView):
    """
    POST /api/auth/login/  { "username": "...", "password": "..." }

    On success, Django creates a session and sets the `sessionid` cookie.
    The user object is returned so the frontend can route by role
    immediately without a follow-up /me/ request.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")

        if not username or not password:
            return Response(
                {"detail": "Username and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = authenticate(request, username=username, password=password)
        if user is None:
            # Deliberately vague — do not reveal whether username exists.
            return Response(
                {"detail": "Invalid credentials."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        login(request, user)
        return Response(UserSerializer(user).data)


class LogoutView(APIView):
    """
    POST /api/auth/logout/

    Flushes the session server-side and clears the cookie client-side.
    """

    def post(self, request):
        logout(request)
        return Response({"detail": "Logged out."}, status=status.HTTP_200_OK)


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        old_password = request.data.get("old_password")
        new_password = request.data.get("new_password")

        if not user.check_password(old_password):
            return Response({"detail": "Current password is incorrect."}, status=400)

        try:
            # Enforce Django's password rules (length, symbols, etc.)
            validate_password(new_password, user)
        except ValidationError as e:
            return Response({"detail": e.messages[0]}, status=400)

        user.set_password(new_password)
        user.save()
        
        # Keep the user logged in after the password change
        update_session_auth_hash(request, user)
        
        return Response({"detail": "Password changed successfully."})