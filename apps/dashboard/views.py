from django.db.models import Count
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.donations.models import Donation
from apps.requests.models import FoodRequest


class AdminDashboardView(APIView):

    permission_classes = [
        IsAuthenticated
    ]

    def get(self, request):

        if not (
            request.user.role == User.Role.ADMIN
            or request.user.is_staff
        ):

            return Response({
                "success": False,
                "message":
                    "Administrator access required."
            }, status=403)

        return Response({
            "success": True,
            "data": {
                "total_users":
                    User.objects.count(),

                "total_donors":
                    User.objects.filter(
                        role=User.Role.DONOR
                    ).count(),

                "total_receivers":
                    User.objects.filter(
                        role=User.Role.RECEIVER
                    ).count(),

                "total_donations":
                    Donation.objects.count(),

                "available_donations":
                    Donation.objects.filter(
                        status=Donation.Status.AVAILABLE
                    ).count(),

                "completed_donations":
                    Donation.objects.filter(
                        status=Donation.Status.COMPLETED
                    ).count(),

                "pending_requests":
                    FoodRequest.objects.filter(
                        status=FoodRequest.Status.PENDING
                    ).count(),
            },
        })


class DonorDashboardView(APIView):

    permission_classes = [
        IsAuthenticated
    ]

    def get(self, request):

        if request.user.role != User.Role.DONOR:

            return Response(
                {
                    "success": False,
                    "message":
                        "Donor access required."
                },
                status=403,
            )

        donations = Donation.objects.filter(
            donor=request.user
        )

        return Response({
            "success": True,
            "data": {
                "total_donations":
                    donations.count(),

                "active_donations":
                    donations.filter(
                        status=Donation.Status.AVAILABLE
                    ).count(),

                "completed_donations":
                    donations.filter(
                        status=Donation.Status.COMPLETED
                    ).count(),

                "pending_requests":
                    FoodRequest.objects.filter(
                        donation__donor=request.user,
                        status=FoodRequest.Status.PENDING,
                    ).count(),
            },
        })


class ReceiverDashboardView(APIView):

    permission_classes = [
        IsAuthenticated
    ]

    def get(self, request):

        if request.user.role != User.Role.RECEIVER:

            return Response(
                {
                    "success": False,
                    "message":
                        "Receiver access required."
                },
                status=403,
            )

        return Response({
            "success": True,
            "data": {
                "available_donations":
                    Donation.objects.filter(
                        status=Donation.Status.AVAILABLE
                    ).count(),

                "my_requests":
                    FoodRequest.objects.filter(
                        receiver=request.user
                    ).count(),

                "accepted_requests":
                    FoodRequest.objects.filter(
                        receiver=request.user,
                        status=FoodRequest.Status.ACCEPTED,
                    ).count(),

                "completed_requests":
                    FoodRequest.objects.filter(
                        receiver=request.user,
                        status=FoodRequest.Status.COMPLETED,
                    ).count(),
            },
        })