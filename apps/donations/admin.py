from django.contrib import admin
from .models import Donation


@admin.register(Donation)
class DonationAdmin(admin.ModelAdmin):

    list_display = (
        "title",
        "donor",
        "food_type",
        "quantity",
        "quantity_unit",
        "city",
        "status",
        "expiry_at",
        "created_at",
    )

    list_filter = (
        "food_type",
        "status",
        "city",
        "quantity_unit",
    )

    search_fields = (
        "title",
        "description",
        "donor__username",
        "city",
        "pincode",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )
