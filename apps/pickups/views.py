from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.donations.models import Donation
from apps.requests.models import FoodRequest

from .models import Pickup
from .serializers import PickupSerializer


class PickupViewSet(viewsets.ModelViewSet):
    serializer_class = PickupSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        if not user.is_authenticated:
            return Pickup.objects.none()

        if user.role == user.Role.DONOR:
            return Pickup.objects.filter(
                food_request__donation__donor=user
            ).select_related(
                "food_request",
                "food_request__donation",
                "food_request__receiver",
            )

        if user.role == user.Role.RECEIVER:
            return Pickup.objects.filter(
                food_request__receiver=user
            ).select_related(
                "food_request",
                "food_request__donation",
                "food_request__receiver",
            )

        return Pickup.objects.none()

    def create(self, request, *args, **kwargs):
        if request.user.role != request.user.Role.DONOR:
            return Response(
                {
                    "success": False,
                    "message": "Only donors can schedule pickups.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        requested_food_request = serializer.validated_data[
            "food_request"
        ]

        with transaction.atomic():
            food_request = (
                FoodRequest.objects.select_for_update()
                .select_related("donation")
                .filter(pk=requested_food_request.pk)
                .first()
            )

            if food_request is None:
                return Response(
                    {
                        "success": False,
                        "message": "Food request not found.",
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            if food_request.donation.donor_id != request.user.id:
                return Response(
                    {
                        "success": False,
                        "message": "You cannot schedule this pickup.",
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            if food_request.status != FoodRequest.Status.ACCEPTED:
                return Response(
                    {
                        "success": False,
                        "message": (
                            "Only accepted requests can have a pickup."
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if Pickup.objects.filter(
                food_request=food_request
            ).exists():
                return Response(
                    {
                        "success": False,
                        "message": (
                            "A pickup already exists for this request."
                        ),
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            # The OneToOneField also protects against duplicate pickups.
            # Catching IntegrityError here would require a nested atomic
            # block; the database constraint remains the final safeguard.
            pickup = serializer.save(food_request=food_request)

        return Response(
            {
                "success": True,
                "message": "Pickup scheduled successfully.",
                "data": self.get_serializer(pickup).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="mark-picked-up",
    )
    @transaction.atomic
    def mark_picked_up(self, request, pk=None):
        pickup = (
            self.get_queryset()
            .select_for_update()
            .filter(pk=pk)
            .first()
        )

        if pickup is None:
            return Response(
                {
                    "success": False,
                    "message": "Pickup not found.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if request.user.role != request.user.Role.RECEIVER:
            return Response(
                {
                    "success": False,
                    "message": (
                        "Only the receiver can confirm collection."
                    ),
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if pickup.food_request.receiver_id != request.user.id:
            return Response(
                {
                    "success": False,
                    "message": "You cannot confirm this pickup.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if pickup.status != Pickup.Status.SCHEDULED:
            return Response(
                {
                    "success": False,
                    "message": (
                        "Only scheduled pickups can be marked as picked up."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        pickup.status = Pickup.Status.PICKED_UP
        pickup.picked_up_at = timezone.now()

        pickup.save(
            update_fields=[
                "status",
                "picked_up_at",
                "updated_at",
            ]
        )

        return Response(
            {
                "success": True,
                "message": "Collection confirmed.",
                "data": self.get_serializer(pickup).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="complete",
    )
    @transaction.atomic
    def complete(self, request, pk=None):
        # Lock the pickup and related records during the transition.
        pickup = (
            Pickup.objects.select_for_update()
            .filter(pk=pk)
            .first()
        )

        if pickup is None:
            return Response(
                {
                    "success": False,
                    "message": "Pickup not found.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        food_request = (
            FoodRequest.objects.select_for_update()
            .select_related("donation")
            .filter(pk=pickup.food_request_id)
            .first()
        )

        if food_request is None:
            return Response(
                {
                    "success": False,
                    "message": "Food request not found.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        donation = (
            Donation.objects.select_for_update()
            .filter(pk=food_request.donation_id)
            .first()
        )

        if donation is None:
            return Response(
                {
                    "success": False,
                    "message": "Donation not found.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if request.user.role not in (
            request.user.Role.DONOR,
            request.user.Role.RECEIVER,
        ):
            return Response(
                {
                    "success": False,
                    "message": "You cannot complete this pickup.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if (
            donation.donor_id != request.user.id
            and food_request.receiver_id != request.user.id
        ):
            return Response(
                {
                    "success": False,
                    "message": "You cannot complete this pickup.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # A pickup must be collected before it can be completed.
        if pickup.status != Pickup.Status.PICKED_UP:
            return Response(
                {
                    "success": False,
                    "message": (
                        "Pickup must be marked as picked up "
                        "before it can be completed."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = timezone.now()

        pickup.status = Pickup.Status.COMPLETED
        pickup.completed_at = now
        pickup.save(
            update_fields=[
                "status",
                "completed_at",
                "updated_at",
            ]
        )

        donation.status = Donation.Status.COMPLETED
        donation.save(
            update_fields=["status", "updated_at"]
        )

        food_request.status = FoodRequest.Status.COMPLETED
        food_request.save(
            update_fields=["status", "updated_at"]
        )

        return Response(
            {
                "success": True,
                "message": "Pickup completed successfully.",
            },
            status=status.HTTP_200_OK,
        )
