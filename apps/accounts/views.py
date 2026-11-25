from django.shortcuts import render, redirect
from django.contrib.auth import login as django_login
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.conf import settings
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.views import View

from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User, DonorProfile, ReceiverProfile
from .serializers import (
    RegisterSerializer,
    LoginSerializer,
    UserSerializer,
    DonorProfileSerializer,
    ReceiverProfileSerializer,
)


# ============================================================
# API: REGISTER
# ============================================================

class RegisterView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        """
        Redirect GET requests from browser directly to the registration page
        to prevent HTTP 405 Method Not Allowed error.
        """
        return redirect("register")

    def post(self, request):
        serializer = RegisterSerializer(
            data=request.data
        )

        if serializer.is_valid():
            user = serializer.save()

            return Response(
                {
                    "success": True,
                    "message": "Registration successful.",
                    "data": UserSerializer(user).data,
                },
                status=status.HTTP_201_CREATED,
            )

        return Response(
            {
                "success": False,
                "message": "Registration failed.",
                "errors": serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


# ============================================================
# API: LOGIN
# ============================================================

class LoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        """
        Redirect GET requests from browser directly to the login page
        to prevent HTTP 405 Method Not Allowed error.
        """
        return redirect("login")

    def post(self, request):
        serializer = LoginSerializer(
            data=request.data,
            context={"request": request}
        )

        if serializer.is_valid():
            user = serializer.validated_data["user"]
            refresh = RefreshToken.for_user(user)

            return Response(
                {
                    "success": True,
                    "message": "Login successful.",
                    "data": {
                        "user": UserSerializer(user).data,
                        "access": str(refresh.access_token),
                        "refresh": str(refresh),
                    },
                },
                status=status.HTTP_200_OK,
            )

        return Response(
            {
                "success": False,
                "message": "Invalid email or password.",
                "errors": serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


# ============================================================
# API: CURRENT USER
# ============================================================

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            "success": True,
            "data": UserSerializer(request.user).data,
        })


# ============================================================
# API: LOGOUT
# ============================================================

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")

        if not refresh_token:
            return Response(
                {
                    "success": False,
                    "message": "Refresh token is required."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            return Response(
                {
                    "success": False,
                    "message": "Invalid refresh token."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response({
            "success": True,
            "message": "Logout successful."
        })


# ============================================================
# API: DONOR PROFILE
# ============================================================

class DonorProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.DONOR:
            return Response(
                {"message": "Donor access required."},
                status=status.HTTP_403_FORBIDDEN,
            )

        profile, _ = DonorProfile.objects.get_or_create(
            user=request.user,
            defaults={
                "organization_name": request.user.get_full_name() or request.user.username,
                "address": "",
                "city": "",
                "state": "",
                "pincode": "",
            },
        )

        serializer = DonorProfileSerializer(profile)
        return Response({
            "success": True,
            "data": serializer.data,
        })

    def put(self, request):
        if request.user.role != User.Role.DONOR:
            return Response(
                {"message": "Donor access required."},
                status=status.HTTP_403_FORBIDDEN,
            )

        profile, _ = DonorProfile.objects.get_or_create(
            user=request.user,
            defaults={
                "organization_name": request.user.get_full_name() or request.user.username,
                "address": "",
                "city": "",
                "state": "",
                "pincode": "",
            },
        )

        serializer = DonorProfileSerializer(
            profile,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)

        return Response({
            "success": True,
            "message": "Donor profile updated.",
            "data": serializer.data,
        })


# ============================================================
# API: RECEIVER PROFILE
# ============================================================

class ReceiverProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.RECEIVER:
            return Response(
                {"message": "Receiver access required."},
                status=status.HTTP_403_FORBIDDEN,
            )

        profile, _ = ReceiverProfile.objects.get_or_create(
            user=request.user,
            defaults={
                "organization_name": request.user.get_full_name() or request.user.username,
                "address": "",
                "city": "",
                "state": "",
                "pincode": "",
            },
        )

        serializer = ReceiverProfileSerializer(profile)
        return Response({
            "success": True,
            "data": serializer.data,
        })

    def put(self, request):
        if request.user.role != User.Role.RECEIVER:
            return Response(
                {"message": "Receiver access required."},
                status=status.HTTP_403_FORBIDDEN,
            )

        profile, _ = ReceiverProfile.objects.get_or_create(
            user=request.user,
            defaults={
                "organization_name": request.user.get_full_name() or request.user.username,
                "address": "",
                "city": "",
                "state": "",
                "pincode": "",
            },
        )

        serializer = ReceiverProfileSerializer(
            profile,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)

        return Response({
            "success": True,
            "message": "Receiver profile updated.",
            "data": serializer.data,
        })


# ============================================================
# API: UNIFIED USER PROFILE (For /api/v1/auth/profile/)
# ============================================================

class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_profile(self, user):
        if user.role == User.Role.DONOR:
            profile, _ = DonorProfile.objects.get_or_create(
                user=user,
                defaults={
                    "organization_name": user.get_full_name() or user.username,
                    "address": "",
                    "city": "",
                    "state": "",
                    "pincode": "",
                },
            )
            return profile
        elif user.role == User.Role.RECEIVER:
            profile, _ = ReceiverProfile.objects.get_or_create(
                user=user,
                defaults={
                    "organization_name": user.get_full_name() or user.username,
                    "address": "",
                    "city": "",
                    "state": "",
                    "pincode": "",
                },
            )
            return profile
        return None

    def get(self, request):
        user = request.user
        profile = self._get_profile(user)

        profile_img_url = ""
        if profile and getattr(profile, "profile_image", None):
            try:
                profile_img_url = profile.profile_image.url
            except Exception:
                profile_img_url = ""

        return Response({
            "success": True,
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "phone": user.phone,
            "phone_no": user.phone,
            "role": user.role,
            "address": getattr(profile, "address", "") or "",
            "city": getattr(profile, "city", "") or "",
            "state": getattr(profile, "state", "") or "",
            "pincode": getattr(profile, "pincode", "") or "",
            "organization_name": getattr(profile, "organization_name", "") or "",
            "profile_image": profile_img_url,
        })

    def patch(self, request):
        user = request.user
        profile = self._get_profile(user)
        data = request.data

        if "first_name" in data:
            user.first_name = data["first_name"]
        if "last_name" in data:
            user.last_name = data["last_name"]
        if "phone" in data:
            user.phone = data["phone"]
        elif "phone_no" in data:
            user.phone = data["phone_no"]
        user.save()

        if profile:
            if "address" in data:
                profile.address = data["address"]
            if "city" in data:
                profile.city = data["city"]
            if "state" in data:
                profile.state = data["state"]
            if "pincode" in data:
                profile.pincode = data["pincode"]
            if "organization_name" in data:
                profile.organization_name = data["organization_name"]
            profile.save()

        return self.get(request)

    def put(self, request):
        return self.patch(request)


# ============================================================
# FRONTEND PAGE VIEWS (Handle GET and POST without 405)
# ============================================================

class LoginPageView(View):

    def get(self, request):
        return render(request, "auth/login.html")

    def post(self, request):
        # Support JSON API POST to /login/
        if request.content_type == "application/json" or request.headers.get("Accept") == "application/json":
            api_view = LoginView.as_view()
            return api_view(request)

        # Standard browser form submit POST to /login/
        email = request.POST.get("email", "").strip()
        password = request.POST.get("password", "")

        serializer = LoginSerializer(data={"email": email, "password": password})
        if serializer.is_valid():
            user = serializer.validated_data["user"]
            django_login(request, user)
            if user.role == User.Role.DONOR:
                return redirect("donor_dashboard")
            elif user.role == User.Role.RECEIVER:
                return redirect("receiver_dashboard")
            elif user.role == User.Role.ADMIN:
                return redirect("admin_dashboard")
            return redirect("home")

        error_message = "Invalid email or password."
        if serializer.errors:
            err = next(iter(serializer.errors.values()))
            error_message = err[0] if isinstance(err, list) else err

        return render(
            request,
            "auth/login.html",
            {"error": error_message, "email": email},
            status=status.HTTP_400_BAD_REQUEST,
        )


# ============================================================
# API: PASSWORD RESET (Forgot Password)
# ============================================================

class PasswordResetRequestView(APIView):
    """
    POST { "email": "user@example.com" }
    Always responds with the same success message (security best practice).
    Sends a real password-reset link to the console (dev) or SMTP (prod).
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        from django.contrib.auth.tokens import default_token_generator
        from django.core.mail import send_mail
        from django.utils.http import urlsafe_base64_encode
        from django.utils.encoding import force_bytes
        from django.conf import settings

        email = (request.data.get("email") or "").strip().lower()

        if email:
            try:
                user = User.objects.get(email__iexact=email)
                uid   = urlsafe_base64_encode(force_bytes(user.pk))
                token = default_token_generator.make_token(user)
                base  = getattr(settings, "FRONTEND_BASE_URL", "http://127.0.0.1:8000")
                reset_link = f"{base}/reset-password/{uid}/{token}/"

                subject = "FoodShare — Reset Your Password"
                body = (
                    f"Hi {user.first_name or user.username},\n\n"
                    f"We received a request to reset the password for your FoodShare account "
                    f"associated with {email}.\n\n"
                    f"Click the link below to set a new password (valid for 24 hours):\n"
                    f"{reset_link}\n\n"
                    f"If you did not request this, you can safely ignore this email — "
                    f"your password will not change.\n\n"
                    f"— The FoodShare Team"
                )
                html_body = f"""
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:30px;border:1px solid #e0e0e0;border-radius:12px;">
  <div style="text-align:center;margin-bottom:24px;">
    <span style="font-size:40px;">🌿</span>
    <h2 style="color:#2e7d32;margin:8px 0 0;">FoodShare</h2>
  </div>
  <h3 style="color:#333;">Reset Your Password</h3>
  <p style="color:#555;line-height:1.6;">
    Hi <strong>{user.first_name or user.username}</strong>,<br><br>
    We received a request to reset the password for the FoodShare account associated with
    <strong>{email}</strong>.
  </p>
  <div style="text-align:center;margin:30px 0;">
    <a href="{reset_link}"
       style="background:#2e7d32;color:#fff;text-decoration:none;padding:14px 32px;
              border-radius:8px;font-weight:600;font-size:16px;display:inline-block;">
      Reset Password
    </a>
  </div>
  <p style="color:#888;font-size:13px;line-height:1.6;">
    This link expires in <strong>24 hours</strong>. If you did not request a password reset,
    you can safely ignore this email.
  </p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
  <p style="color:#aaa;font-size:12px;text-align:center;">© 2026 FoodShare · Reducing food waste together</p>
</div>
"""
                send_mail(
                    subject=subject,
                    message=body,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    html_message=html_body,
                    fail_silently=True,
                )
            except User.DoesNotExist:
                pass   # don't reveal whether the account exists

        # Always return the same response — security best practice
        return Response(
            {
                "success": True,
                "message": "If an account exists with this email, password reset instructions have been sent.",
            },
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(APIView):
    """
    POST { "uid": "...", "token": "...", "new_password": "..." }
    Validates the token and sets the new password.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.http import urlsafe_base64_decode
        from django.utils.encoding import force_str

        uid       = request.data.get("uid", "")
        token     = request.data.get("token", "")
        password  = request.data.get("new_password", "")

        if not all([uid, token, password]):
            return Response(
                {"success": False, "message": "uid, token and new_password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(password) < 8:
            return Response(
                {"success": False, "message": "Password must be at least 8 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user_pk = force_str(urlsafe_base64_decode(uid))
            user    = User.objects.get(pk=user_pk)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            return Response(
                {"success": False, "message": "Invalid or expired reset link."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not default_token_generator.check_token(user, token):
            return Response(
                {"success": False, "message": "Reset link is invalid or has expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(password)
        user.save()

        return Response(
            {"success": True, "message": "Password reset successfully. You can now log in."},
            status=status.HTTP_200_OK,
        )


class RegisterPageView(View):

    def get(self, request):
        return render(request, "auth/register.html")

    def post(self, request):
        # Support JSON API POST to /register/
        if request.content_type == "application/json" or request.headers.get("Accept") == "application/json":
            api_view = RegisterView.as_view()
            return api_view(request)

        # Standard browser form submit POST to /register/
        data = {
            "first_name": request.POST.get("first_name", "").strip(),
            "last_name": request.POST.get("last_name", "").strip(),
            "email": request.POST.get("email", "").strip(),
            "phone": request.POST.get("phone_no", "") or request.POST.get("phone", ""),
            "address": request.POST.get("address", "").strip(),
            "password": request.POST.get("password", ""),
            "password_confirm": request.POST.get("password_confirm", ""),
            "role": request.POST.get("role", "DONOR"),
        }

        serializer = RegisterSerializer(data=data)
        if serializer.is_valid():
            user = serializer.save()
            django_login(request, user)
            if user.role == User.Role.DONOR:
                return redirect("donor_dashboard")
            elif user.role == User.Role.RECEIVER:
                return redirect("receiver_dashboard")
            elif user.role == User.Role.ADMIN:
                return redirect("admin_dashboard")
            return redirect("home")

        error_messages = []
        for field, err in serializer.errors.items():
            msg = err if isinstance(err, str) else ", ".join(err)
            error_messages.append(f"{field.replace('_', ' ').capitalize()}: {msg}")

        return render(
            request,
            "auth/register.html",
            {
                "error": "\n".join(error_messages),
                "form_data": data,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )
