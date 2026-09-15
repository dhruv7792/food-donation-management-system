from django.conf import settings
from django.db import models

from apps.donations.models import Donation


class FoodRequest(models.Model):

    class Status(models.TextChoices):

        PENDING = "PENDING", "Pending"
        ACCEPTED = "ACCEPTED", "Accepted"
        REJECTED = "REJECTED", "Rejected"
        CANCELLED = "CANCELLED", "Cancelled"
        COMPLETED = "COMPLETED", "Completed"

    donation = models.ForeignKey(
        Donation,
        on_delete=models.CASCADE,
        related_name="food_requests",
    )

    receiver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="food_requests",
    )

    requested_quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
    )

    message = models.TextField(
        blank=True
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )

    requested_at = models.DateTimeField(
        auto_now_add=True
    )

    accepted_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:

        ordering = [
            "-requested_at"
        ]

        indexes = [
            models.Index(
                fields=["status"]
            ),
            models.Index(
                fields=["receiver"]
            ),
            models.Index(
                fields=["donation"]
            ),
        ]

    def __str__(self):

        return (
            f"{self.receiver.username} - "
            f"{self.donation.title}"
        )
