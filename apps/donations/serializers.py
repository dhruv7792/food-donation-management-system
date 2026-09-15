from django.utils import timezone
from rest_framework import serializers
from .models import Donation


class DonationSerializer(serializers.ModelSerializer):

    donor_name = serializers.CharField(
        source="donor.username",
        read_only=True,
    )

    class Meta:

        model = Donation

        fields = [
            "id",
            "donor",
            "donor_name",
            "title",
            "description",
            "food_type",
            "quantity",
            "quantity_unit",
            "prepared_at",
            "expiry_at",
            "pickup_start",
            "pickup_end",
            "address",
            "city",
            "state",
            "pincode",
            "latitude",
            "longitude",
            "image",
            "status",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "donor",
            "status",
            "created_at",
            "updated_at",
        ]

    def validate_quantity(self, value):

        if value <= 0:
            raise serializers.ValidationError(
                "Quantity must be greater than zero."
            )

        return value

    def validate(self, attrs):

        prepared_at = attrs.get(
            "prepared_at"
        )

        expiry_at = attrs.get(
            "expiry_at"
        )

        pickup_start = attrs.get(
            "pickup_start"
        )

        pickup_end = attrs.get(
            "pickup_end"
        )

        if (
            prepared_at
            and expiry_at
            and expiry_at <= prepared_at
        ):
            raise serializers.ValidationError({
                "expiry_at":
                    "Expiry must be after preparation time."
            })

        if (
            pickup_start
            and pickup_end
            and pickup_end <= pickup_start
        ):
            raise serializers.ValidationError({
                "pickup_end":
                    "Pickup end must be after pickup start."
            })

        if expiry_at and expiry_at <= timezone.now():
            raise serializers.ValidationError({
                "expiry_at":
                    "Expiry time must be in the future."
            })

        return attrs