from rest_framework import serializers
from .models import Pickup


class PickupSerializer(
    serializers.ModelSerializer
):

    class Meta:

        model = Pickup

        fields = [
            "id",
            "food_request",
            "pickup_code",
            "pickup_date",
            "pickup_time",
            "volunteer_name",
            "volunteer_phone",
            "status",
            "picked_up_at",
            "completed_at",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "pickup_code",
            "status",
            "picked_up_at",
            "completed_at",
            "created_at",
            "updated_at",
        ]