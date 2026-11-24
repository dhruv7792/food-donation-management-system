import django_filters
from .models import Donation


class DonationFilter(
    django_filters.FilterSet
):

    city = django_filters.CharFilter(
        lookup_expr="iexact"
    )

    food_type = django_filters.CharFilter(
        method="filter_food_type"
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

    def filter_food_type(self, queryset, name, value):
        if not value:
            return queryset
        val = value.strip().upper()
        if val in ["VEGETARIAN", "VEGETABLES"]:
            val = "VEG"
        elif val == "NON-VEGETARIAN":
            val = "NON_VEG"
        return queryset.filter(food_type__iexact=val)

    class Meta:

        model = Donation

        fields = [
            "city",
            "food_type",
            "status",
            "min_quantity",
            "max_quantity",
        ]