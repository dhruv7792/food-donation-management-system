
import django_filters
from django.utils import timezone

from .models import Donation


class DonationFilter(django_filters.FilterSet):

    city = django_filters.CharFilter(
        field_name="city",
        lookup_expr="iexact",
    )

    food_type = django_filters.CharFilter(
        field_name="food_type",
        lookup_expr="iexact",
    )

    status = django_filters.CharFilter(
        method="filter_status",
    )

    min_quantity = django_filters.NumberFilter(
        field_name="quantity",
        lookup_expr="gte",
    )

    max_quantity = django_filters.NumberFilter(
        field_name="quantity",
        lookup_expr="lte",
    )

    def filter_status(self, queryset, name, value):
        value = value.strip().upper()

        if value == "EXPIRED":
            return queryset.filter(
                expiry_at__lte=timezone.now()
            )

        return queryset.filter(status__iexact=value)

    class Meta:
        model = Donation
        fields = [
            "city",
            "food_type",
            "status",
            "min_quantity",
            "max_quantity",
        ]
