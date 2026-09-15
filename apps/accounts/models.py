from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):

    class Role(models.TextChoices):
        DONOR = "DONOR", "Donor"
        RECEIVER = "RECEIVER", "Receiver"
        ADMIN = "ADMIN", "Administrator"

    email = models.EmailField(unique=True)

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.DONOR,
    )

    phone = models.CharField(
        max_length=15,
        blank=True,
    )

    is_verified = models.BooleanField(
        default=False
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    def __str__(self):
        return f"{self.username} - {self.role}"


class DonorProfile(models.Model):

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="donor_profile",
    )

    organization_name = models.CharField(
        max_length=150,
        blank=True,
    )

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

    profile_image = models.ImageField(
        upload_to="profiles/donors/",
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    def __str__(self):
        return self.organization_name or self.user.username


class ReceiverProfile(models.Model):

    class OrganizationType(models.TextChoices):
        NGO = "NGO", "NGO"
        SHELTER = "SHELTER", "Shelter"
        ORPHANAGE = "ORPHANAGE", "Orphanage"
        OLD_AGE_HOME = "OLD_AGE_HOME", "Old Age Home"
        VOLUNTEER = "VOLUNTEER", "Volunteer Organization"
        OTHER = "OTHER", "Other"

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="receiver_profile",
    )

    organization_name = models.CharField(
        max_length=150
    )

    organization_type = models.CharField(
        max_length=30,
        choices=OrganizationType.choices,
        default=OrganizationType.NGO,
    )

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

    profile_image = models.ImageField(
        upload_to="profiles/receivers/",
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    def __str__(self):
        return self.organization_name
