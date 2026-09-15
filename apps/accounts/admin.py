from django.contrib import admin

from .models import (
    User,
    DonorProfile,
    ReceiverProfile,
)


@admin.register(User)
class UserAdmin(admin.ModelAdmin):

    list_display = (
        "username",
        "email",
        "role",
        "is_verified",
        "is_active",
        "created_at",
    )

    list_filter = (
        "role",
        "is_verified",
        "is_active",
    )

    search_fields = (
        "username",
        "email",
        "phone",
    )


@admin.register(DonorProfile)
class DonorProfileAdmin(admin.ModelAdmin):

    list_display = (
        "organization_name",
        "user",
        "city",
        "state",
        "pincode",
    )

    search_fields = (
        "organization_name",
        "user__username",
        "city",
    )


@admin.register(ReceiverProfile)
class ReceiverProfileAdmin(admin.ModelAdmin):

    list_display = (
        "organization_name",
        "organization_type",
        "user",
        "city",
    )

    list_filter = (
        "organization_type",
        "city",
    )

    search_fields = (
        "organization_name",
        "user__username",
        "city",
    )