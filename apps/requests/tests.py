from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.donations.models import Donation
from apps.requests.models import FoodRequest
from apps.requests.serializers import FoodRequestSerializer
from apps.requests.views import FoodRequestViewSet


User = get_user_model()


class FoodRequestSerializerTests(TestCase):
    def setUp(self):
        self.donor = User.objects.create_user(
            username="test_donor",
            email="donor@example.com",
            password="TestPass123!",
            role="DONOR",
        )

        self.receiver = User.objects.create_user(
            username="test_receiver",
            email="receiver@example.com",
            password="TestPass123!",
            role="RECEIVER",
        )

        now = timezone.now()

        self.donation = Donation.objects.create(
            donor=self.donor,
            title="Vegetable Rice",
            description="Freshly prepared rice",
            food_type=Donation.FoodType.VEG,
            quantity=Decimal("10.00"),
            quantity_unit=Donation.QuantityUnit.KG,
            prepared_at=now - timedelta(hours=1),
            expiry_at=now + timedelta(hours=5),
            pickup_start=now + timedelta(minutes=30),
            pickup_end=now + timedelta(hours=4),
            address="Test Street",
            city="Ahmedabad",
            state="Gujarat",
            pincode="380001",
            status=Donation.Status.AVAILABLE,
        )

    def test_positive_quantity_is_valid(self):
        serializer = FoodRequestSerializer(
            data={
                "donation": self.donation.pk,
                "requested_quantity": "2.00",
                "message": "Needed for our community.",
            }
        )

        self.assertTrue(
            serializer.is_valid(),
            serializer.errors,
        )

    def test_zero_quantity_is_invalid(self):
        serializer = FoodRequestSerializer(
            data={
                "donation": self.donation.pk,
                "requested_quantity": "0.00",
                "message": "",
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn(
            "requested_quantity",
            serializer.errors,
        )

    def test_quantity_above_donation_quantity_is_invalid(self):
        serializer = FoodRequestSerializer(
            data={
                "donation": self.donation.pk,
                "requested_quantity": "11.00",
                "message": "",
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn(
            "requested_quantity",
            serializer.errors,
        )


class FoodRequestPermissionTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

        self.donor = User.objects.create_user(
            username="request_donor",
            email="request_donor@example.com",
            password="TestPass123!",
            role="DONOR",
        )

        self.receiver = User.objects.create_user(
            username="request_receiver",
            email="request_receiver@example.com",
            password="TestPass123!",
            role="RECEIVER",
        )

        now = timezone.now()

        self.donation = Donation.objects.create(
            donor=self.donor,
            title="Fresh Bread",
            description="Fresh bakery items",
            food_type=Donation.FoodType.BAKERY,
            quantity=Decimal("5.00"),
            quantity_unit=Donation.QuantityUnit.KG,
            prepared_at=now - timedelta(hours=1),
            expiry_at=now + timedelta(hours=5),
            pickup_start=now + timedelta(minutes=30),
            pickup_end=now + timedelta(hours=4),
            address="Test Street",
            city="Ahmedabad",
            state="Gujarat",
            pincode="380001",
            status=Donation.Status.AVAILABLE,
        )

    def test_receiver_can_create_request(self):
        request = self.factory.post(
            "/api/v1/requests/",
            {
                "donation": self.donation.pk,
                "requested_quantity": "2.00",
                "message": "For our shelter",
            },
            format="json",
        )
        force_authenticate(request, user=self.receiver)

        view = FoodRequestViewSet.as_view({"post": "create"})
        response = view(request)

        self.assertEqual(response.status_code, 201)
        self.assertTrue(
            FoodRequest.objects.filter(
                donation=self.donation,
                receiver=self.receiver,
            ).exists()
        )

    def test_donor_cannot_create_request(self):
        request = self.factory.post(
            "/api/v1/requests/",
            {
                "donation": self.donation.pk,
                "requested_quantity": "2.00",
                "message": "",
            },
            format="json",
        )
        force_authenticate(request, user=self.donor)

        view = FoodRequestViewSet.as_view({"post": "create"})
        response = view(request)

        self.assertEqual(response.status_code, 403)
        self.assertFalse(
            FoodRequest.objects.filter(
                donation=self.donation,
            ).exists()
        )
