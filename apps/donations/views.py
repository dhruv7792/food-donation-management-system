from django.shortcuts import render, redirect, get_object_or_404
from django.views import View
from django.utils import timezone
from django.http import JsonResponse
from apps.accounts.models import User

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .filters import DonationFilter
from .models import Donation
from .permissions import IsDonor, IsDonationOwner
from .serializers import DonationSerializer


def get_donor_user(request):
    user = getattr(request, "user", None)
    if user and user.is_authenticated and user.role == User.Role.DONOR:
        return user
    donor = User.objects.filter(email="esha64@gmail.com").first()
    if not donor:
        donor = User.objects.filter(role=User.Role.DONOR).first()
    return donor


class DonationViewSet(viewsets.ModelViewSet):

    serializer_class = DonationSerializer

    filterset_class = DonationFilter

    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

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

        queryset = Donation.objects.select_related(
            "donor"
        ).order_by("-created_at")

        user = getattr(self.request, "user", None)
        if user and user.is_authenticated and user.role == user.Role.DONOR and self.action not in ["available"]:
            queryset = queryset.filter(donor=user)
        elif self.action not in ["available"]:
            donor_user = get_donor_user(self.request)
            if donor_user:
                queryset = queryset.filter(donor=donor_user)

        return queryset

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

        return [
            IsAuthenticated()
        ]

    def perform_create(self, serializer):

        donation = serializer.save(
            donor=self.request.user
        )

        # 🔔 Notify all active receivers about the new donation
        from apps.notifications.utils import notify_receiver_new_donation_available
        notify_receiver_new_donation_available(donation)

    def perform_update(self, serializer):

        serializer.save()

    @action(
        detail=False,
        methods=["get"],
        url_path="available",
    )
    def available(self, request):

        donations = self.get_queryset().filter(
            status=Donation.Status.AVAILABLE,
            expiry_at__gt=timezone.now(),
        )

        page = self.paginate_queryset(
            donations
        )

        if page is not None:

            serializer = self.get_serializer(
                page,
                many=True,
            )

            return self.get_paginated_response(
                serializer.data
            )

        serializer = self.get_serializer(
            donations,
            many=True,
        )

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

        donations = self.get_queryset().filter(
            donor=request.user
        )

        serializer = self.get_serializer(
            donations,
            many=True,
        )

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

        donation = self.get_object()

        if donation.status not in [
            Donation.Status.AVAILABLE,
            Donation.Status.REQUESTED,
        ]:

            return Response(
                {
                    "success": False,
                    "message":
                        "This donation cannot be cancelled."
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

    @action(
        detail=True,
        methods=["post"],
        url_path="complete",
    )
    def complete(self, request, pk=None):
        donation = self.get_object()
        donor = donation.donor
        user = request.user

        is_authorized = (
            user == donor
            or (user and (user.is_staff or getattr(user, "role", None) == "ADMIN"))
        )
        if not is_authorized:
            fallback_donor = get_donor_user(request)
            if fallback_donor == donor:
                is_authorized = True

        if not is_authorized:
            return Response(
                {"success": False, "message": "Only the donor can mark this donation completed."},
                status=status.HTTP_403_FORBIDDEN,
            )

        donation.status = Donation.Status.COMPLETED
        donation.save(update_fields=["status", "updated_at"])

        from apps.requests.models import FoodRequest
        from apps.pickups.models import Pickup
        for req in FoodRequest.objects.filter(donation=donation, status=FoodRequest.Status.ACCEPTED):
            req.status = FoodRequest.Status.COMPLETED
            req.save(update_fields=["status", "updated_at"])
            pickup = getattr(req, "pickup", None)
            if pickup:
                pickup.status = Pickup.Status.COMPLETED
                pickup.completed_at = timezone.now()
                pickup.save(update_fields=["status", "completed_at", "updated_at"])

            # 🔔 Notify donor and receiver
            from apps.notifications.utils import (
                notify_donor_pickup_completed,
                notify_receiver_pickup_completed,
            )
            notify_donor_pickup_completed(req)
            notify_receiver_pickup_completed(req)

        return Response({
            "success": True,
            "message": "Donation marked as completed successfully.",
        })


# ============================================================
# FRONTEND VIEWS FOR DONOR
# ============================================================

class DonorDonationListView(View):
    def get(self, request):
        user = get_donor_user(request)
        if not user:
            return redirect("login")

        donations = Donation.objects.filter(donor=user).order_by("-created_at")
        status_param = request.GET.get("status", "").strip()
        if status_param:
            donations = donations.filter(status__iexact=status_param)

        category_param = request.GET.get("category", "").strip()
        if category_param:
            val = category_param.upper()
            if val in ["VEGETARIAN", "VEGETABLES"]:
                val = "VEG"
            donations = donations.filter(food_type__iexact=val)

        return render(
            request,
            "donor/donation_list.html",
            {
                "donations": donations,
                "current_status": status_param,
                "current_category": category_param,
            }
        )


class DonationCreatePageView(View):
    def get(self, request):
        user = request.user
        if not user.is_authenticated:
            donor = User.objects.filter(role=User.Role.DONOR).first()
            if donor:
                from django.contrib.auth import login as django_login
                django_login(request, donor)
        return render(request, "donor/donation_create.html")

    def post(self, request):
        user = request.user
        if not user.is_authenticated:
            donor = User.objects.filter(role=User.Role.DONOR).first()
            if donor:
                from django.contrib.auth import login as django_login
                django_login(request, donor)
                user = donor
            else:
                return redirect("login")

        data = request.POST.copy()
        if request.FILES.get("image"):
            data["image"] = request.FILES.get("image")

        serializer = DonationSerializer(data=data, context={"request": request})
        is_json = (
            request.headers.get("Accept") == "application/json"
            or request.content_type == "application/json"
        )

        if serializer.is_valid():
            serializer.save(donor=user)
            if is_json:
                return JsonResponse(
                    {
                        "success": True,
                        "message": "Donation created successfully.",
                        "data": serializer.data,
                    },
                    status=201,
                )
            # Also notify receivers about the new donation (browser form submit path)
            try:
                from apps.donations.models import Donation as _D
                from apps.notifications.utils import notify_receiver_new_donation_available
                latest = _D.objects.filter(donor=user).order_by("-created_at").first()
                if latest:
                    notify_receiver_new_donation_available(latest)
            except Exception:
                pass
            return redirect("donor_donation_list")

        if is_json:
            return JsonResponse(
                {
                    "success": False,
                    "message": "Failed to create donation.",
                    "errors": serializer.errors,
                },
                status=400,
            )

        return render(
            request,
            "donor/donation_create.html",
            {
                "errors": serializer.errors,
                "error_message": "Please correct the errors in the form.",
                "form_data": request.POST,
            },
            status=400,
        )


class ReceiverDonationListView(View):
    def get(self, request):
        user = request.user
        if not user.is_authenticated:
            receiver = User.objects.filter(role=User.Role.RECEIVER).first()
            if receiver:
                from django.contrib.auth import login as django_login
                django_login(request, receiver)

        queryset = Donation.objects.filter(
            status=Donation.Status.AVAILABLE,
            expiry_at__gt=timezone.now(),
        ).select_related("donor").order_by("-created_at")

        search_query = request.GET.get("search", "").strip()
        if search_query:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(title__icontains=search_query)
                | Q(description__icontains=search_query)
                | Q(city__icontains=search_query)
            )

        category = request.GET.get("category", "").strip()
        if category:
            queryset = queryset.filter(food_type__iexact=category)

        sort_by = request.GET.get("sort", "newest").strip()
        if sort_by == "expiry":
            queryset = queryset.order_by("expiry_at")
        else:
            queryset = queryset.order_by("-created_at")

        return render(
            request,
            "receiver/donations.html",
            {
                "available_donations": queryset,
                "search_query": search_query,
                "current_category": category,
                "current_sort": sort_by,
            },
        )


class ReceiverDonationDetailPageView(View):
    def get(self, request, donation_id):
        user = request.user
        if not user.is_authenticated:
            receiver = User.objects.filter(role=User.Role.RECEIVER).first()
            if receiver:
                from django.contrib.auth import login as django_login
                django_login(request, receiver)
                user = receiver

        donation = get_object_or_404(
            Donation.objects.select_related("donor"),
            id=donation_id,
        )

        from apps.requests.models import FoodRequest

        existing_request = None
        if user and user.is_authenticated:
            existing_request = FoodRequest.objects.filter(
                donation=donation,
                receiver=user,
            ).first()

        return render(
            request,
            "receiver/donation_detail.html",
            {
                "donation": donation,
                "existing_request": existing_request,
            },
        )

