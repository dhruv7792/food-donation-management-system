import re
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password

from rest_framework import serializers

from .models import User, DonorProfile, ReceiverProfile


class UserSerializer(serializers.ModelSerializer):

    class Meta:
        model = User

        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "phone",
            "role",
            "is_verified",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "is_verified",
            "created_at",
        ]


class RegisterSerializer(serializers.ModelSerializer):

    username = serializers.CharField(
        required=False,
        allow_blank=True,
    )

    email = serializers.EmailField()

    password = serializers.CharField(
        write_only=True,
        validators=[validate_password],
    )

    password_confirm = serializers.CharField(
        write_only=True
    )

    address = serializers.CharField(
        required=False,
        allow_blank=True,
        write_only=True,
    )

    phone_no = serializers.CharField(
        required=False,
        allow_blank=True,
        write_only=True,
    )

    class Meta:
        model = User

        fields = [
            "username",
            "email",
            "password",
            "password_confirm",
            "first_name",
            "last_name",
            "phone",
            "phone_no",
            "address",
            "role",
        ]

    def validate_email(self, value):

        value = value.strip().lower()

        if User.objects.filter(
            email__iexact=value
        ).exists():

            raise serializers.ValidationError(
                "Email already registered."
            )

        return value

    def validate(self, attrs):

        if attrs.get("password") != attrs.get("password_confirm"):
            raise serializers.ValidationError({
                "password_confirm": "Passwords do not match."
            })

        if attrs.get("role") == User.Role.ADMIN:
            raise serializers.ValidationError({
                "role": "Administrator accounts cannot be created publicly."
            })

        # Map phone_no to phone
        if not attrs.get("phone") and attrs.get("phone_no"):
            attrs["phone"] = attrs["phone_no"]

        # Ensure a clean and unique username
        email = attrs.get("email", "")
        base_username = (attrs.get("username") or "").strip()
        if not base_username:
            base_username = email.split("@")[0].lower() if "@" in email else "user"
            base_username = re.sub(r"[^a-zA-Z0-9_]", "", base_username)[:30] or "user"

        username = base_username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username[:25]}_{counter}"
            counter += 1
        attrs["username"] = username

        return attrs

    def create(self, validated_data):

        validated_data.pop("password_confirm", None)
        validated_data.pop("phone_no", None)
        password = validated_data.pop("password")
        address = validated_data.pop("address", "")

        user = User.objects.create_user(
            password=password,
            **validated_data
        )

        org_name = user.get_full_name() or user.username
        if user.role == User.Role.DONOR:
            DonorProfile.objects.create(
                user=user,
                organization_name=org_name,
                address=address or "",
                city="",
                state="",
                pincode="",
            )
        elif user.role == User.Role.RECEIVER:
            ReceiverProfile.objects.create(
                user=user,
                organization_name=org_name,
                address=address or "",
                city="",
                state="",
                pincode="",
            )

        return user


class LoginSerializer(serializers.Serializer):

    email = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):

        login_val = (attrs.get("email") or "").strip()
        password = attrs.get("password")

        if not login_val or not password:
            raise serializers.ValidationError({
                "detail": "Please enter both email/username and password."
            })

        user = None
        if "@" in login_val:
            user = User.objects.filter(email__iexact=login_val.lower()).first()
        else:
            user = User.objects.filter(username__iexact=login_val).first()
            if not user:
                user = User.objects.filter(email__iexact=login_val.lower()).first()

        if not user:
            raise serializers.ValidationError({
                "detail": "Invalid email or password."
            })

        if not user.check_password(password):
            raise serializers.ValidationError({
                "detail": "Invalid email or password."
            })

        if not user.is_active:
            raise serializers.ValidationError({
                "detail": "Your account is inactive."
            })

        attrs["user"] = user

        return attrs
class DonorProfileSerializer(serializers.ModelSerializer):

    class Meta:
        model = DonorProfile

        fields = "__all__"

        read_only_fields = [
            "user",
            "created_at",
            "updated_at",
        ]


class ReceiverProfileSerializer(serializers.ModelSerializer):

    class Meta:
        model = ReceiverProfile

        fields = "__all__"

        read_only_fields = [
            "user",
            "created_at",
            "updated_at",
        ]