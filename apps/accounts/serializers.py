from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password

from rest_framework import serializers

from .models import User, DonorProfile, ReceiverProfile


# ============================================================
# USER SERIALIZER
# ============================================================

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


# ============================================================
# REGISTER SERIALIZER
# ============================================================

class RegisterSerializer(serializers.ModelSerializer):

    password = serializers.CharField(
        write_only=True,
        validators=[validate_password],
    )

    password_confirm = serializers.CharField(
        write_only=True
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

        if attrs["password"] != attrs["password_confirm"]:

            raise serializers.ValidationError({
                "password_confirm":
                    "Passwords do not match."
            })

        if attrs["role"] == User.Role.ADMIN:

            raise serializers.ValidationError({
                "role":
                    "Administrator accounts cannot be created publicly."
            })

        return attrs

    def create(self, validated_data):
        from django.db import transaction

        password = validated_data.pop("password")
        validated_data.pop("password_confirm")

        with transaction.atomic():
            user = User.objects.create_user(
                password=password,
                **validated_data
            )

            if user.role == User.Role.DONOR:
                DonorProfile.objects.create(user=user)

            elif user.role == User.Role.RECEIVER:
                ReceiverProfile.objects.create(user=user)

        return user


# ============================================================
# LOGIN SERIALIZER
# ============================================================

class LoginSerializer(serializers.Serializer):

    email = serializers.EmailField()

    password = serializers.CharField(
        write_only=True
    )

    def validate(self, attrs):

        email = attrs["email"].strip().lower()

        password = attrs["password"]

        # Find user using email
        try:

            user = User.objects.get(
                email__iexact=email
            )

        except User.DoesNotExist:

            raise serializers.ValidationError(
                "Invalid email or password."
            )

        # Check password
        if not user.check_password(password):

            raise serializers.ValidationError(
                "Invalid email or password."
            )

        # Check active account
        if not user.is_active:

            raise serializers.ValidationError(
                "Your account is inactive."
            )

        # Add user to validated data
        attrs["user"] = user

        return attrs


# ============================================================
# DONOR PROFILE SERIALIZER
# ============================================================

class DonorProfileSerializer(serializers.ModelSerializer):

    class Meta:
        model = DonorProfile

        fields = [
            "id",
            "organization_name",
            "address",
            "city",
            "state",
            "pincode",
            "latitude",
            "longitude",
            "profile_image",
        ]

        read_only_fields = [
            "id",
        ]


# ============================================================
# RECEIVER PROFILE SERIALIZER
# ============================================================


class ReceiverProfileSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(
        source="user.first_name",
        required=False,
        allow_blank=True
    )
    last_name = serializers.CharField(
        source="user.last_name",
        required=False,
        allow_blank=True
    )
    email = serializers.EmailField(
        source="user.email",
        read_only=True
    )
    phone_no = serializers.CharField(
        source="user.phone",
        required=False,
        allow_blank=True
    )

    class Meta:
        model = ReceiverProfile
        fields = [
            "id",
            "first_name",
            "last_name",
            "email",
            "phone_no",
            "organization_name",
            "organization_type",
            "address",
            "city",
            "state",
            "pincode",
            "latitude",
            "longitude",
            "profile_image",
        ]
        read_only_fields = ["id", "email"]

    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})

        for field in ["first_name", "last_name", "phone"]:
            if field in user_data:
                setattr(instance.user, field, user_data[field])

        if user_data:
            instance.user.save(
                update_fields=[
                    field for field in
                    ["first_name", "last_name", "phone"]
                    if field in user_data
                ]
            )

        return super().update(instance, validated_data)


class ReceiverProfileUpdateSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150, required=False)
    last_name = serializers.CharField(max_length=150, required=False)
    email = serializers.EmailField(read_only=True)
    phone_no = serializers.CharField(max_length=15, required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)

    def update(self, instance, validated_data):
        user = instance.user

        user.first_name = validated_data.get(
            "first_name", user.first_name
        )
        user.last_name = validated_data.get(
            "last_name", user.last_name
        )
        user.phone = validated_data.get(
            "phone_no", user.phone
        )
        user.save()

        instance.address = validated_data.get(
            "address", instance.address
        )
        instance.save()

        return instance

    