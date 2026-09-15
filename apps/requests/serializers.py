from django.utils import timezone
from rest_framework import serializers
from .models import FoodRequest


class FoodRequestSerializer(
    serializers.ModelSerializer
):

    receiver_name = serializers.CharField(
        source="receiver.username",
        read_only=True,
    )

    donation_title = serializers.CharField(
        source="donation.title",
        read_only=True,
    )

    class Meta:

        model = FoodRequest

        fields = [
            "id",
            "donation",
            "donation_title",
            "receiver",
            "receiver_name",
            "requested_quantity",
            "message",
            "status",
            "requested_at",
            "accepted_at",
            "updated_at",
        ]

        read_only_fields = [
            "receiver",
            "status",
            "requested_at",
            "accepted_at",
            "updated_at",
        ]

    def validate_requested_quantity(
        self,
        value
    ):

        if value <= 0:

            raise serializers.ValidationError(
                "Requested quantity must be greater than zero."
            )

        return value

    def validate(self, attrs):

        donation = attrs["donation"]

        quantity = attrs[
            "requested_quantity"
        ]

        if donation.status != "AVAILABLE":

            raise serializers.ValidationError({
                "donation":
                    "This donation is not available."
            })

        if donation.expiry_at <= timezone.now():

            raise serializers.ValidationError({
                "donation":
                    "This donation has expired."
            })

        if quantity > donation.quantity:

            raise serializers.ValidationError({
                "requested_quantity":
                    "Requested quantity exceeds donation quantity."
            })

        return attrs