
from django.contrib import admin
from .models import Pickup


@admin.register(Pickup)
class PickupAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "food_request",
        "pickup_date",
        "pickup_time",
        "status",
        "pickup_code",
    )

    list_filter = ("status", "pickup_date")
    search_fields = ("pickup_code",)
    ordering = ("-created_at",)
