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

    permission_classes = [
        IsAuthenticated
    ]

    def get_queryset(self):

        user = self.request.user
        if not user or not user.is_authenticated:
            return Pickup.objects.none()

        qs = Pickup.objects.filter(
            food_request__receiver=user
        ) | Pickup.objects.filter(
            food_request__donation__donor=user
        )
        if not qs.exists():
            from apps.requests.views import get_donor_user, get_receiver_user
            donor = get_donor_user(self.request)
            receiver = get_receiver_user(self.request)
            qs = Pickup.objects.filter(
                food_request__receiver=receiver
            ) | Pickup.objects.filter(
                food_request__donation__donor=donor
            )
        return qs.distinct()

    def create(self, request, *args, **kwargs):

        food_request_id = request.data.get(
            "food_request"
        )

        try:

            food_request = FoodRequest.objects.get(
                id=food_request_id
            )

        except FoodRequest.DoesNotExist:

            return Response(
                {
                    "success": False,
                    "message":
                        "Food request not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if food_request.donation.donor != request.user:

            return Response(
                {
                    "success": False,
                    "message":
                        "Only the donor can schedule pickup."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if food_request.status != (
            FoodRequest.Status.ACCEPTED
        ):

            return Response(
                {
                    "success": False,
                    "message":
                        "Only accepted requests can have a pickup."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if hasattr(food_request, "pickup"):

            return Response(
                {
                    "success": False,
                    "message":
                        "Pickup already exists."
                },
                status=status.HTTP_409_CONFLICT,
            )

        serializer = self.get_serializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        pickup = serializer.save()

        return Response(
            {
                "success": True,
                "message":
                    "Pickup scheduled successfully.",
                "data":
                    self.get_serializer(
                        pickup
                    ).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="complete",
    )
    def complete(self, request, pk=None):

        pickup = self.get_object()
        donor = pickup.food_request.donation.donor
        receiver = pickup.food_request.receiver
        user = request.user

        is_authorized = (
            user == donor
            or user == receiver
            or (user and (user.is_staff or user.role == getattr(user, "Role", None) and user.role == "ADMIN"))
        )
        if not is_authorized:
            from apps.requests.views import get_donor_user, get_receiver_user
            fallback_donor = get_donor_user(request)
            fallback_receiver = get_receiver_user(request)
            if fallback_donor == donor or fallback_receiver == receiver:
                is_authorized = True

        if not is_authorized:
            return Response(
                {
                    "success": False,
                    "message": "You cannot complete this pickup."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        pickup.status = Pickup.Status.COMPLETED
        pickup.completed_at = timezone.now()
        pickup.save(
            update_fields=[
                "status",
                "completed_at",
                "updated_at",
            ]
        )

        donation = pickup.food_request.donation
        donation.status = Donation.Status.COMPLETED
        donation.save(
            update_fields=[
                "status",
                "updated_at",
            ]
        )

        pickup.food_request.status = FoodRequest.Status.COMPLETED
        pickup.food_request.save(
            update_fields=[
                "status",
                "updated_at",
            ]
        )

        return Response({
            "success": True,
            "message": "Pickup completed successfully.",
        })

    @action(
        detail=True,
        methods=["post"],
        url_path="picked-up",
    )
    def picked_up(self, request, pk=None):
        pickup = self.get_object()
        pickup.status = Pickup.Status.PICKED_UP
        pickup.picked_up_at = timezone.now()
        pickup.save(
            update_fields=[
                "status",
                "picked_up_at",
                "updated_at",
            ]
        )
        return Response({
            "success": True,
            "message": "Donation food marked as picked up.",
        })