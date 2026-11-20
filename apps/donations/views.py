from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .filters import DonationFilter
from .models import Donation
from .permissions import IsDonor, IsDonationOwner
from .serializers import DonationSerializer

def expire_outdated_donations():
    now = timezone.now()

    Donation.objects.filter(
        expiry_at__lte=now,
    ).exclude(
        status__in=[
            Donation.Status.EXPIRED,
            Donation.Status.COMPLETED,
            Donation.Status.CANCELLED,
        ],
    ).update(
        status=Donation.Status.EXPIRED,
        updated_at=now,
    )
    
class DonationViewSet(viewsets.ModelViewSet):
    serializer_class = DonationSerializer
    filterset_class = DonationFilter

    search_fields = [
        "title",
        "description",
        "city",
        "pincode",
    ]

    ordering_fields = [
        "created_at",
        "expiry_at",
        "quantity",
    ]

    def get_queryset(self):
        return Donation.objects.select_related("donor")

    def get_permissions(self):
        if self.action == "create":
            return [
                IsAuthenticated(),
                IsDonor(),
            ]

        if self.action in [
            "update",
            "partial_update",
            "destroy",
            "cancel",
        ]:
            return [
                IsAuthenticated(),
                IsDonationOwner(),
            ]

        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(donor=self.request.user)

    def perform_update(self, serializer):
        serializer.save()

    @action(
        detail=False,
        methods=["get"],
        url_path="available",
    )
    def available(self, request):
        """
        Return only donations that are AVAILABLE
        and have not expired.
        """
        donations = self.get_queryset().filter(
            status=Donation.Status.AVAILABLE,
            expiry_at__gt=timezone.now(),
        )

        donations = self.filter_queryset(donations)

        page = self.paginate_queryset(donations)

        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(donations, many=True)

        return Response({
            "success": True,
            "data": serializer.data,
        })

    @action(
        detail=False,
        methods=["get"],
        url_path="my",
    )
    def my_donations(self, request):
        """
        Return donations belonging to the logged-in user.
        """
        donations = self.get_queryset().filter(
            donor=request.user
        )

        donations = self.filter_queryset(donations)

        page = self.paginate_queryset(donations)

        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(donations, many=True)

        return Response({
            "success": True,
            "data": serializer.data,
        })

    @action(
        detail=True,
        methods=["post"],
        url_path="cancel",
    )
    def cancel(self, request, pk=None):
        """
        Allow the donation owner to cancel an eligible donation.
        """
        donation = self.get_object()

        if donation.status not in [
            Donation.Status.AVAILABLE,
            Donation.Status.REQUESTED,
        ]:
            return Response(
                {
                    "success": False,
                    "message": "This donation cannot be cancelled.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        donation.status = Donation.Status.CANCELLED
        donation.save(
            update_fields=[
                "status",
                "updated_at",
            ]
        )

        return Response({
            "success": True,
            "message": "Donation cancelled successfully.",
        })
