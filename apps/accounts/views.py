from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
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
# REGISTER
# ============================================================

class RegisterView(APIView):

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):

        try:
            serializer = RegisterSerializer(data=request.data)

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

        except Exception as e:

            return Response(
                {
                    "success": False,
                    "message": "Registration failed.",
                    "error": str(e),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# ============================================================
# LOGIN
# ============================================================

class LoginView(APIView):

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):

        try:
            serializer = LoginSerializer(data=request.data)

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

        except Exception as e:

            return Response(
                {
                    "success": False,
                    "message": "Login failed.",
                    "error": str(e),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# ============================================================
# CURRENT USER
# ============================================================

class MeView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):

        return Response(
            {
                "success": True,
                "data": UserSerializer(request.user).data,
            },
            status=status.HTTP_200_OK,
        )


# ============================================================
# LOGOUT
# ============================================================

class LogoutView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):

        refresh_token = request.data.get("refresh")

        if not refresh_token:
            return Response(
                {
                    "success": False,
                    "message": "Refresh token is required.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()

            return Response(
                {
                    "success": True,
                    "message": "Logout successful.",
                },
                status=status.HTTP_200_OK,
            )

        except Exception:
            return Response(
                {
                    "success": False,
                    "message": "Invalid refresh token.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )


# ============================================================
# DONOR PROFILE
# ============================================================

class DonorProfileView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):

        if request.user.role != User.Role.DONOR:
            return Response(
                {
                    "success": False,
                    "message": "Donor access required.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        profile, created = DonorProfile.objects.get_or_create(
            user=request.user
        )

        serializer = DonorProfileSerializer(profile)

        return Response(
            {
                "success": True,
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def put(self, request, *args, **kwargs):

        if request.user.role != User.Role.DONOR:
            return Response(
                {
                    "success": False,
                    "message": "Donor access required.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        profile, created = DonorProfile.objects.get_or_create(
            user=request.user
        )

        serializer = DonorProfileSerializer(
            profile,
            data=request.data,
            partial=True
        )

        if serializer.is_valid():
            serializer.save(user=request.user)

            return Response(
                {
                    "success": True,
                    "message": "Donor profile updated.",
                    "data": serializer.data,
                },
                status=status.HTTP_200_OK,
            )

        return Response(
            {
                "success": False,
                "errors": serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


# ============================================================
# RECEIVER PROFILE
# ============================================================


class ReceiverProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get_profile(self, user):
        if user.role != User.Role.RECEIVER:
            return None

        profile, created = ReceiverProfile.objects.get_or_create(
            user=user,
            defaults={"organization_name": user.username}
        )
        return profile

    def get(self, request):
        profile = self.get_profile(request.user)

        if profile is None:
            return Response(
                {"success": False, "message": "Receiver account required."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = ReceiverProfileSerializer(profile)
        data = serializer.data
        data["first_name"] = request.user.first_name
        data["last_name"] = request.user.last_name
        data["email"] = request.user.email
        data["phone_no"] = request.user.phone

        return Response({"success": True, "data": data})

    def put(self, request):
        profile = self.get_profile(request.user)

        if profile is None:
            return Response(
                {"success": False, "message": "Receiver account required."},
                status=status.HTTP_403_FORBIDDEN
            )

        user = request.user

        user_serializer = UserSerializer(
            user,
            data={
                "first_name": request.data.get("first_name", user.first_name),
                "last_name": request.data.get("last_name", user.last_name),
                "phone": request.data.get("phone_no", user.phone),
            },
            partial=True
        )

        if not user_serializer.is_valid():
            return Response(
                {"success": False, "errors": user_serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        profile_serializer = ReceiverProfileSerializer(
            profile,
            data=request.data,
            partial=True
        )

        if not profile_serializer.is_valid():
            return Response(
                {"success": False, "errors": profile_serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        user_serializer.save()
        profile_serializer.save()

        data = profile_serializer.data
        data["first_name"] = user.first_name
        data["last_name"] = user.last_name
        data["email"] = user.email
        data["phone_no"] = user.phone

        return Response({
            "success": True,
            "message": "Receiver profile updated.",
            "data": data
        })