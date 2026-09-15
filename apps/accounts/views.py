from rest_framework import status
from rest_framework.permissions import IsAuthenticated
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


class RegisterView(APIView):

    permission_classes = []

    def post(self, request):

        serializer = RegisterSerializer(
            data=request.data
        )

        serializer.is_valid(raise_exception=True)

        user = serializer.save()

        return Response(
            {
                "success": True,
                "message": "Registration successful.",
                "data": UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):

    permission_classes = []

    def post(self, request):

        serializer = LoginSerializer(
            data=request.data
        )

        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]

        refresh = RefreshToken.for_user(user)

        return Response({
            "success": True,
            "message": "Login successful.",
            "data": {
                "user": UserSerializer(user).data,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
        })


class MeView(APIView):

    permission_classes = [
        IsAuthenticated
    ]

    def get(self, request):

        return Response({
            "success": True,
            "data": UserSerializer(
                request.user
            ).data,
        })


class LogoutView(APIView):

    permission_classes = [
        IsAuthenticated
    ]

    def post(self, request):

        refresh_token = request.data.get(
            "refresh"
        )

        if not refresh_token:

            return Response(
                {
                    "success": False,
                    "message": "Refresh token is required.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:

            token = RefreshToken(
                refresh_token
            )

            token.blacklist()

        except Exception:

            return Response(
                {
                    "success": False,
                    "message": "Invalid refresh token.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "success": True,
                "message": "Logout successful.",
            }
        )


class DonorProfileView(APIView):

    permission_classes = [
        IsAuthenticated
    ]

    def get(self, request):

        if request.user.role != User.Role.DONOR:
            return Response(
                {"message": "Donor access required."},
                status=status.HTTP_403_FORBIDDEN,
            )

        profile, _ = DonorProfile.objects.get_or_create(
            user=request.user
        )

        serializer = DonorProfileSerializer(
            profile
        )

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
            user=request.user
        )

        serializer = DonorProfileSerializer(
            profile,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(
            raise_exception=True
        )

        serializer.save(
            user=request.user
        )

        return Response({
            "success": True,
            "message": "Donor profile updated.",
            "data": serializer.data,
        })


class ReceiverProfileView(APIView):

    permission_classes = [
        IsAuthenticated
    ]

    def get(self, request):

        if request.user.role != User.Role.RECEIVER:
            return Response(
                {"message": "Receiver access required."},
                status=status.HTTP_403_FORBIDDEN,
            )

        profile, _ = ReceiverProfile.objects.get_or_create(
            user=request.user
        )

        serializer = ReceiverProfileSerializer(
            profile
        )

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
            user=request.user
        )

        serializer = ReceiverProfileSerializer(
            profile,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(
            raise_exception=True
        )

        serializer.save(
            user=request.user
        )

        return Response({
            "success": True,
            "message": "Receiver profile updated.",
            "data": serializer.data,
        })
