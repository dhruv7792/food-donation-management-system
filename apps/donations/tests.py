from datetime import timedelta
from django.utils import timezone

from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User

from .models import Donation


class DonationTests(APITestCase):

    def setUp(self):

        self.donor = User.objects.create_user(
            username="donor",
            email="donor@test.com",
            password="Password@123",
            role=User.Role.DONOR,
        )

        self.client.force_authenticate(
            user=self.donor
        )

    def test_create_donation(self):

        now = timezone.now()

        data = {
            "title": "Fresh Biryani",
            "description": "Fresh vegetarian biryani.",
            "food_type": "VEG",
            "quantity": "20",
            "quantity_unit": "PLATE",
            "prepared_at": now.isoformat(),
            "expiry_at": (
                now + timedelta(hours=5)
            ).isoformat(),
            "pickup_start": (
                now + timedelta(hours=1)
            ).isoformat(),
            "pickup_end": (
                now + timedelta(hours=3)
            ).isoformat(),
            "address": "Ahmedabad",
            "city": "Ahmedabad",
            "state": "Gujarat",
            "pincode": "380001",
        }

        response = self.client.post(
            "/api/v1/donations/",
            data,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        self.assertEqual(
            Donation.objects.count(),
            1,
        )