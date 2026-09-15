import uuid
from django.db import models
from apps.requests.models import FoodRequest

def generate_pickup_code():
    return uuid.uuid4().hex[:8].upper()

class Pickup(models.Model):

    class Status(models.TextChoices):

        SCHEDULED = "SCHEDULED", "Scheduled"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        PICKED_UP = "PICKED_UP", "Picked Up"
        COMPLETED = "COMPLETED", "Completed"
        FAILED = "FAILED", "Failed"

    food_request = models.OneToOneField(
        FoodRequest,
        on_delete=models.CASCADE,
        related_name="pickup",
    )

    pickup_code = models.CharField(
        max_length=20,
        unique=True,
        default=lambda: uuid.uuid4().hex[:8].upper(),
    )

    pickup_date = models.DateField()

    pickup_time = models.TimeField()

    volunteer_name = models.CharField(
        max_length=150,
        blank=True,
    )

    volunteer_phone = models.CharField(
        max_length=15,
        blank=True,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SCHEDULED,
    )

    picked_up_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    completed_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )
    pickup_code = models.CharField(
        max_length=20,
        unique=True,
        default=generate_pickup_code,
    )
    def __str__(self):

        return (
            f"Pickup {self.pickup_code}"
        )
