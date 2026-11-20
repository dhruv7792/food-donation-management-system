from datetime import date, time, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.donations.models import Donation
from apps.requests.models import FoodRequest
from apps.pickups.models import Pickup
from apps.pickups.views import PickupViewSet

User = get_user_model()


class PickupWorkflowTests(TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.donor = User.objects.create_user(
            username="pickup_donor",
            email="donor@example.com",
            password="TestPassword123!",
            role="DONOR",
        )

        cls.receiver = User.objects.create_user(
            username="pickup_receiver",
            email="receiver@example.com",
            password="TestPassword123!",
            role="RECEIVER",
        )

        cls.other_donor = User.objects.create_user(
            username="other_donor",
            email="other@example.com",
            password="TestPassword123!",
            role="DONOR",
        )

        cls.donation = Donation.objects.create(
            donor=cls.donor,
            title="Test food donation",
            description="Fresh prepared food",
            food_type="VEG",
            quantity=Decimal("10.00"),
            quantity_unit="KG",
            prepared_at=timezone.now() - timedelta(hours=1),
            expiry_at=timezone.now() + timedelta(days=2),
            pickup_start=timezone.now() + timedelta(hours=1),
            pickup_end=timezone.now() + timedelta(hours=4),
            address="Test address",
            city="Vadodara",
            state="Gujarat",
            pincode="390001",
            status="ACCEPTED",
        )

        cls.food_request = FoodRequest.objects.create(
            donation=cls.donation,
            receiver=cls.receiver,
            requested_quantity=Decimal("2.00"),
            message="Test pickup",
            status="ACCEPTED",
        )

    def setUp(self):
        self.factory = APIRequestFactory()

    def call_action(self, action, user, pickup_id=None, data=None):
        view = getattr(PickupViewSet, action)
        request = (
            self.factory.post("/", data or {}, format="json")
            if data is not None
            else self.factory.post("/", {}, format="json")
        )
        force_authenticate(request, user=user)

        if action == "create":
            response = view(PickupViewSet.as_view({"post": "create"})) if False else None
            handler = PickupViewSet.as_view({"post": "create"})
            response = handler(request)
        else:
            handler = PickupViewSet.as_view({"post": action}, detail=True)
            response = handler(request, pk=pickup_id)

        return response

    def create_pickup(self):
        return Pickup.objects.create(
            food_request=self.food_request,
            pickup_date=date.today() + timedelta(days=1),
            pickup_time=time(10, 30),
        )

    def test_donor_can_schedule_pickup(self):
        response = self.call_action(
            "create",
            self.donor,
            data={
                "food_request": self.food_request.id,
                "pickup_date": (date.today() + timedelta(days=1)).isoformat(),
                "pickup_time": "10:30:00",
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(
            Pickup.objects.filter(food_request=self.food_request).exists()
        )

    def test_receiver_cannot_schedule_pickup(self):
        response = self.call_action(
            "create",
            self.receiver,
            data={
                "food_request": self.food_request.id,
                "pickup_date": (date.today() + timedelta(days=1)).isoformat(),
                "pickup_time": "10:30:00",
            },
        )

        self.assertEqual(response.status_code, 403)

    def test_unrelated_donor_cannot_schedule_pickup(self):
        response = self.call_action(
            "create",
            self.other_donor,
            data={
                "food_request": self.food_request.id,
                "pickup_date": (date.today() + timedelta(days=1)).isoformat(),
                "pickup_time": "10:30:00",
            },
        )

        self.assertIn(response.status_code, (403, 404))

    def test_duplicate_pickup_is_rejected(self):
        self.create_pickup()

        response = self.call_action(
            "create",
            self.donor,
            data={
                "food_request": self.food_request.id,
                "pickup_date": (date.today() + timedelta(days=1)).isoformat(),
                "pickup_time": "11:00:00",
            },
        )

        self.assertIn(response.status_code, (400, 409))

    def test_donor_cannot_mark_pickup_as_picked_up(self):
        pickup = self.create_pickup()

        response = self.call_action(
            "mark_picked_up",
            self.donor,
            pickup_id=pickup.id,
        )

        self.assertEqual(response.status_code, 403)

    def test_assigned_receiver_can_mark_pickup_as_picked_up(self):
        pickup = self.create_pickup()

        response = self.call_action(
            "mark_picked_up",
            self.receiver,
            pickup_id=pickup.id,
        )

        self.assertEqual(response.status_code, 200)

        pickup.refresh_from_db()
        self.assertEqual(pickup.status, Pickup.Status.PICKED_UP)
        self.assertIsNotNone(pickup.picked_up_at)

    def test_pickup_cannot_be_completed_before_collection(self):
        pickup = self.create_pickup()

        response = self.call_action(
            "complete",
            self.donor,
            pickup_id=pickup.id,
        )

        self.assertEqual(response.status_code, 400)

        pickup.refresh_from_db()
        self.assertEqual(pickup.status, Pickup.Status.SCHEDULED)

    def test_completion_updates_pickup_request_and_donation(self):
        pickup = self.create_pickup()
        pickup.status = Pickup.Status.PICKED_UP
        pickup.picked_up_at = timezone.now()
        pickup.save(update_fields=["status", "picked_up_at"])

        response = self.call_action(
            "complete",
            self.donor,
            pickup_id=pickup.id,
        )

        self.assertEqual(response.status_code, 200)

        pickup.refresh_from_db()
        self.food_request.refresh_from_db()
        self.donation.refresh_from_db()

        self.assertEqual(pickup.status, Pickup.Status.COMPLETED)
        self.assertIsNotNone(pickup.completed_at)
        self.assertEqual(self.food_request.status, FoodRequest.Status.COMPLETED)
        self.assertEqual(self.donation.status, Donation.Status.COMPLETED)
