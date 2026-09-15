from django.conf import settings
from django.db import models


class Donation(models.Model):

    class FoodType(models.TextChoices):

        VEG = "VEG", "Vegetarian"
        NON_VEG = "NON_VEG", "Non-Vegetarian"
        VEGAN = "VEGAN", "Vegan"
        BAKERY = "BAKERY", "Bakery"
        FRUITS = "FRUITS", "Fruits"
        PACKAGED = "PACKAGED", "Packaged"
        OTHER = "OTHER", "Other"

    class QuantityUnit(models.TextChoices):

        KG = "KG", "Kilogram"
        LITER = "LITER", "Liter"
        PLATE = "PLATE", "Plate"
        PACKET = "PACKET", "Packet"
        PIECE = "PIECE", "Piece"

    class Status(models.TextChoices):

        AVAILABLE = "AVAILABLE", "Available"
        REQUESTED = "REQUESTED", "Requested"
        ACCEPTED = "ACCEPTED", "Accepted"
        PICKED_UP = "PICKED_UP", "Picked Up"
        COMPLETED = "COMPLETED", "Completed"
        EXPIRED = "EXPIRED", "Expired"
        CANCELLED = "CANCELLED", "Cancelled"

    donor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="donations",
    )

    title = models.CharField(
        max_length=200
    )

    description = models.TextField()

    food_type = models.CharField(
        max_length=20,
        choices=FoodType.choices,
    )

    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
    )

    quantity_unit = models.CharField(
        max_length=20,
        choices=QuantityUnit.choices,
    )

    prepared_at = models.DateTimeField()

    expiry_at = models.DateTimeField()

    pickup_start = models.DateTimeField()

    pickup_end = models.DateTimeField()

    address = models.TextField()

    city = models.CharField(
        max_length=100
    )

    state = models.CharField(
        max_length=100
    )

    pincode = models.CharField(
        max_length=10
    )

    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
    )

    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
    )

    image = models.ImageField(
        upload_to="donations/",
        null=True,
        blank=True,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.AVAILABLE,
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:

        ordering = [
            "-created_at"
        ]

        indexes = [
            models.Index(
                fields=["status"]
            ),
            models.Index(
                fields=["city"]
            ),
            models.Index(
                fields=["food_type"]
            ),
            models.Index(
                fields=["expiry_at"]
            ),
        ]

    def __str__(self):

        return self.title