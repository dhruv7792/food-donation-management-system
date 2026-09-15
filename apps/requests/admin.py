from django.contrib import admin
from .models import FoodRequest


@admin.register(FoodRequest)
class FoodRequestAdmin(admin.ModelAdmin):

    list_display = (
        "id",
        "donation",
        "receiver",
        "requested_quantity",
        "status",
        "requested_at",
    )

    list_filter = (
        "status",
        "requested_at",
    )

    search_fields = (
        "receiver__username",
        "donation__title",
    )
