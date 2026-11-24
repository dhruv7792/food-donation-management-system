from django.shortcuts import render, redirect
from django.contrib.auth import login as django_login
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
