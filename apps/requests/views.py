from django.db import transaction
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import User
from apps.donations.models import Donation

from .models import FoodRequest
from .permissions import IsReceiver
from .serializers import FoodRequestSerializer


class FoodRequestViewSet(
    viewsets.ModelViewSet
):

    serializer_class = FoodRequestSerializer

    permission_classes = [
        IsAuthenticated
    ]

    def get_queryset(self):

        user = self.request.user

        if user.role == User.Role.DONOR:

            return FoodRequest.objects.filter(
                donation__donor=user
            ).select_related(
                "donation",
                "receiver",
            )

        if user.role == User.Role.RECEIVER:

            return FoodRequest.objects.filter(
                receiver=user
            ).select_related(
                "donation",
                "receiver",
            )

        return FoodRequest.objects.all()

    def create(self, request, *args, **kwargs):

        if request.user.role != User.Role.RECEIVER:

            return Response(
                {
                    "success": False,
                    "message":
                        "Only receivers can request food."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = self.get_serializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        donation = serializer.validated_data[
            "donation"
        ]

        existing_request = FoodRequest.objects.filter(
            donation=donation,
            receiver=request.user,
            status=FoodRequest.Status.PENDING,
        ).exists()

        if existing_request:

            return Response(
                {
                    "success": False,
                    "message":
                        "You already requested this donation."
                },
                status=status.HTTP_409_CONFLICT,
            )

        food_request = serializer.save(
            receiver=request.user
        )

        donation.status = (
            Donation.Status.REQUESTED
        )

        donation.save(
            update_fields=[
                "status",
                "updated_at",
            ]
        )

        return Response(
            {
                "success": True,
                "message":
                    "Food request submitted.",
                "data":
                    self.get_serializer(
                        food_request
                    ).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="accept",
    )
    @transaction.atomic
    def accept(self, request, pk=None):

        food_request = self.get_object()

        if (
            food_request.donation.donor
            != request.user
        ):

            return Response(
                {
                    "success": False,
                    "message":
                        "Only the donor can accept this request."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if food_request.status != (
            FoodRequest.Status.PENDING
        ):

            return Response(
                {
                    "success": False,
                    "message":
                        "Only pending requests can be accepted."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        food_request.status = (
            FoodRequest.Status.ACCEPTED
        )

        food_request.accepted_at = timezone.now()

        food_request.save(
            update_fields=[
                "status",
                "accepted_at",
                "updated_at",
            ]
        )

        food_request.donation.status = (
            Donation.Status.ACCEPTED
        )

        food_request.donation.save(
            update_fields=[
                "status",
                "updated_at",
            ]
        )

        return Response({
            "success": True,
            "message":
                "Food request accepted.",
        })

    @action(
        detail=True,
        methods=["post"],
        url_path="reject",
    )
    def reject(self, request, pk=None):

        food_request = self.get_object()

        if (
            food_request.donation.donor
            != request.user
        ):

            return Response(
                {
                    "success": False,
                    "message":
                        "Only the donor can reject this request."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if food_request.status != (
            FoodRequest.Status.PENDING
        ):

            return Response(
                {
                    "success": False,
                    "message":
                        "Only pending requests can be rejected."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        food_request.status = (
            FoodRequest.Status.REJECTED
        )

        food_request.save(
            update_fields=[
                "status",
                "updated_at",
            ]
        )

        food_request.donation.status = (
            Donation.Status.AVAILABLE
        )

        food_request.donation.save(
            update_fields=[
                "status",
                "updated_at",
            ]
        )

        return Response({
            "success": True,
            "message":
                "Food request rejected.",
        })

    @action(
        detail=True,
        methods=["post"],
        url_path="cancel",
    )
    def cancel(self, request, pk=None):

        food_request = self.get_object()

        if (
            food_request.receiver
            != request.user
        ):

            return Response(
                {
                    "success": False,
                    "message":
                        "Only the receiver can cancel this request."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if food_request.status != (
            FoodRequest.Status.PENDING
        ):

            return Response(
                {
                    "success": False,
                    "message":
                        "Only pending requests can be cancelled."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        food_request.status = (
            FoodRequest.Status.CANCELLED
        )

        food_request.save(
            update_fields=[
                "status",
                "updated_at",
            ]
        )

        food_request.donation.status = (
            Donation.Status.AVAILABLE
        )

        food_request.donation.save(
            update_fields=[
                "status",
                "updated_at",
            ]
        )

        return Response({
            "success": True,
            "message":
                "Food request cancelled.",
        })