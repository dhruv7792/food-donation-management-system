import django_filters
from .models import Donation


class DonationFilter(
    django_filters.FilterSet
):

    city = django_filters.CharFilter(
        lookup_expr="iexact"
    )

    food_type = django_filters.CharFilter(
        lookup_expr="iexact"
    )

    status = django_filters.CharFilter(
        lookup_expr="iexact"
    )

    min_quantity = django_filters.NumberFilter(
        field_name="quantity",
        lookup_expr="gte",
    )

    max_quantity = django_filters.NumberFilter(
        field_name="quantity",
        lookup_expr="lte",
    )

    class Meta:

        model = Donation

        fields = [
            "city",
            "food_type",
            "status",
            "min_quantity",
            "max_quantity",
        ]