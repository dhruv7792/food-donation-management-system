import re
from datetime import timedelta
from django.utils import timezone
from rest_framework import serializers
from .models import Donation


def parse_flexible_date(val_str, is_end_of_day=True):
    if not val_str:
        return None
    val_str = str(val_str).strip()
    if not val_str:
        return None
    if "T" in val_str:
        return val_str

    time_part = "23:59:59Z" if is_end_of_day else "00:00:00Z"

    # DD-MM-YYYY or DD/MM/YYYY
    m = re.match(r"^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$", val_str)
    if m:
        d, mon, y = m.groups()
        return f"{y}-{int(mon):02d}-{int(d):02d}T{time_part}"

    # YYYY-MM-DD or YYYY/MM/DD
    m = re.match(r"^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$", val_str)
    if m:
        y, mon, d = m.groups()
        return f"{y}-{int(mon):02d}-{int(d):02d}T{time_part}"

    return val_str


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

    def to_internal_value(self, data):
        # Support QueryDict or standard dict
        if hasattr(data, "dict"):
            mutable_data = data.dict()
        elif hasattr(data, "copy"):
            mutable_data = data.copy()
        else:
            mutable_data = dict(data)

        # 1. Title / Food Name
        if not mutable_data.get("title") and mutable_data.get("food_name"):
            mutable_data["title"] = mutable_data.get("food_name")

        # 2. Food Type / Category mapping
        raw_cat = mutable_data.get("food_type") or mutable_data.get("category")
        if raw_cat:
            cat_upper = str(raw_cat).strip().upper()
            CATEGORY_MAP = {
                "PREPARED": Donation.FoodType.VEG,
                "GRAINS": Donation.FoodType.VEG,
                "VEGETABLES": Donation.FoodType.VEG,
                "VEG": Donation.FoodType.VEG,
                "NON_VEG": Donation.FoodType.NON_VEG,
                "NON-VEG": Donation.FoodType.NON_VEG,
                "MEAT": Donation.FoodType.NON_VEG,
                "VEGAN": Donation.FoodType.VEGAN,
                "FRUITS": Donation.FoodType.FRUITS,
                "BAKERY": Donation.FoodType.BAKERY,
                "PACKAGED": Donation.FoodType.PACKAGED,
                "OTHER": Donation.FoodType.OTHER,
            }
            mutable_data["food_type"] = CATEGORY_MAP.get(cat_upper, Donation.FoodType.OTHER)
        elif not mutable_data.get("food_type"):
            mutable_data["food_type"] = Donation.FoodType.OTHER

        # 3. Quantity Unit mapping
        raw_unit = mutable_data.get("quantity_unit") or mutable_data.get("unit")
        if raw_unit:
            unit_upper = str(raw_unit).strip().upper()
            UNIT_MAP = {
                "KG": Donation.QuantityUnit.KG,
                "G": Donation.QuantityUnit.KG,
                "GRAM": Donation.QuantityUnit.KG,
                "KILOGRAM": Donation.QuantityUnit.KG,
                "LITER": Donation.QuantityUnit.LITER,
                "LITRE": Donation.QuantityUnit.LITER,
                "ML": Donation.QuantityUnit.LITER,
                "PLATE": Donation.QuantityUnit.PLATE,
                "PLATES": Donation.QuantityUnit.PLATE,
                "PACKET": Donation.QuantityUnit.PACKET,
                "PACKETS": Donation.QuantityUnit.PACKET,
                "PIECE": Donation.QuantityUnit.PIECE,
                "PIECES": Donation.QuantityUnit.PIECE,
            }
            mutable_data["quantity_unit"] = UNIT_MAP.get(unit_upper, Donation.QuantityUnit.KG)
        elif not mutable_data.get("quantity_unit"):
            mutable_data["quantity_unit"] = Donation.QuantityUnit.KG

        # 4. Dates & times
        now = timezone.now()
        if not mutable_data.get("prepared_at"):
            mutable_data["prepared_at"] = now.isoformat()

        raw_expiry = mutable_data.get("expiry_at") or mutable_data.get("expiry_date")
        if raw_expiry:
            parsed_expiry = parse_flexible_date(raw_expiry, is_end_of_day=True)
            mutable_data["expiry_at"] = parsed_expiry or (now + timedelta(days=2)).isoformat()
        else:
            mutable_data["expiry_at"] = (now + timedelta(days=2)).isoformat()

        if not mutable_data.get("pickup_start"):
            mutable_data["pickup_start"] = now.isoformat()

        raw_pickup_end = mutable_data.get("pickup_end") or mutable_data.get("pickup_date")
        if raw_pickup_end:
            parsed_pickup = parse_flexible_date(raw_pickup_end, is_end_of_day=True)
            mutable_data["pickup_end"] = parsed_pickup or mutable_data.get("expiry_at")
        else:
            mutable_data["pickup_end"] = mutable_data.get("expiry_at")

        # 5. Address & Location
        if not mutable_data.get("address") and mutable_data.get("pickup_address"):
            mutable_data["address"] = mutable_data.get("pickup_address")

        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        donor_profile = getattr(user, "donor_profile", None) if user and hasattr(user, "donor_profile") else None

        if not mutable_data.get("address"):
            mutable_data["address"] = getattr(donor_profile, "address", "") or "Pickup Address"

        if not mutable_data.get("city"):
            mutable_data["city"] = getattr(donor_profile, "city", "") or "Surat"

        if not mutable_data.get("state"):
            mutable_data["state"] = getattr(donor_profile, "state", "") or "Gujarat"

        if not mutable_data.get("pincode"):
            mutable_data["pincode"] = getattr(donor_profile, "pincode", "") or "395001"

        if not mutable_data.get("description"):
            mutable_data["description"] = "Fresh surplus food donation."

        # Retain uploaded file object if present in original data
        if hasattr(data, "get") and data.get("image") and "image" not in mutable_data:
            mutable_data["image"] = data.get("image")

        return super().to_internal_value(mutable_data)

    def validate_quantity(self, value):

        if value <= 0:
            raise serializers.ValidationError(
                "Quantity must be greater than zero."
            )

        return value

    def validate(self, attrs):

        now = timezone.now()
        prepared_at = attrs.get("prepared_at")
        expiry_at = attrs.get("expiry_at")
        pickup_start = attrs.get("pickup_start")
        pickup_end = attrs.get("pickup_end")

        if not prepared_at:
            attrs["prepared_at"] = now - timedelta(hours=1)
            prepared_at = attrs["prepared_at"]

        if not expiry_at or expiry_at <= now:
            attrs["expiry_at"] = now + timedelta(days=2)
            expiry_at = attrs["expiry_at"]

        if prepared_at and expiry_at and expiry_at <= prepared_at:
            attrs["prepared_at"] = expiry_at - timedelta(hours=2)

        if not pickup_start:
            attrs["pickup_start"] = now
            pickup_start = attrs["pickup_start"]

        if not pickup_end or (pickup_start and pickup_end <= pickup_start):
            attrs["pickup_end"] = max(pickup_start + timedelta(hours=6), expiry_at)

        return attrs