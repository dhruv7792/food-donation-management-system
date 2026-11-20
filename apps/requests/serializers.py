
from django.utils import timezone
from rest_framework import serializers

from apps.donations.models import Donation
from .models import FoodRequest


class FoodRequestSerializer(serializers.ModelSerializer):
    receiver_name = serializers.CharField(
        source="receiver.username",
        read_only=True,
    )

    donation_title = serializers.CharField(
        source="donation.title",
        read_only=True,
    )

    donor_name = serializers.SerializerMethodField()
    pickup_status = serializers.SerializerMethodField()
    completed_at = serializers.SerializerMethodField()
    pickup_code = serializers.SerializerMethodField()

    class Meta:
        model = FoodRequest

        fields = [
            "id",
            "donation",
            "donation_title",
            "donor_name",
            "receiver",
            "receiver_name",
            "requested_quantity",
            "message",
            "status",
            "requested_at",
            "accepted_at",
            "updated_at",
            "pickup_status",
            "completed_at",
            "pickup_code",
        ]

        read_only_fields = [
            "receiver",
            "status",
            "requested_at",
            "accepted_at",
            "updated_at",
            "donor_name",
            "pickup_status",
            "completed_at",
            "pickup_code",
        ]

    def get_donor_name(self, obj):
        donor = obj.donation.donor

        # Prefer the organization's name when available.
        profile = getattr(donor, "donor_profile", None)

        if profile and profile.organization_name:
            return profile.organization_name

        return donor.username

    def get_pickup_status(self, obj):
        pickup = getattr(obj, "pickup", None)

        return pickup.status if pickup else None

    def get_completed_at(self, obj):
        pickup = getattr(obj, "pickup", None)

        return pickup.completed_at if pickup else None

    def get_pickup_code(self, obj):
        pickup = getattr(obj, "pickup", None)

        return pickup.pickup_code if pickup else None

    def validate_requested_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "Requested quantity must be greater than zero."
            )

        return value

    def validate(self, attrs):
        donation = attrs.get(
            "donation",
            getattr(self.instance, "donation", None),
        )

        quantity = attrs.get(
            "requested_quantity",
            getattr(self.instance, "requested_quantity", None),
        )

        if donation is None or quantity is None:
            return attrs

        if donation.status != Donation.Status.AVAILABLE:
            raise serializers.ValidationError({
                "donation": "This donation is not available."
            })

        if donation.expiry_at <= timezone.now():
            raise serializers.ValidationError({
                "donation": "This donation has expired."
            })

        if quantity > donation.quantity:
            raise serializers.ValidationError({
                "requested_quantity":
                    "Requested quantity exceeds donation quantity."
            })

        return attrs
