from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase

from .models import User


class RegistrationTests(APITestCase):

    def test_donor_registration(self):

        data = {
            "username": "donor1",
            "email": "donor@example.com",
            "password": "StrongPassword@123",
            "password_confirm": "StrongPassword@123",
            "first_name": "Food",
            "last_name": "Donor",
            "phone": "9876543210",
            "role": "DONOR",
        }

        response = self.client.post(
            "/api/v1/auth/register/",
            data,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        self.assertTrue(
            User.objects.filter(
                username="donor1"
            ).exists()
        )
