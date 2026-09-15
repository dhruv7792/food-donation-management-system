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

        if User.objects.filter(
            email__iexact=value
        ).exists():

            raise serializers.ValidationError(
                "Email already registered."
            )

        return value.lower()

    def validate(self, attrs):

        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({
                "password_confirm": "Passwords do not match."
            })

        if attrs["role"] == User.Role.ADMIN:
            raise serializers.ValidationError({
                "role": "Administrator accounts cannot be created publicly."
            })

        return attrs

    def create(self, validated_data):

        validated_data.pop("password_confirm")

        password = validated_data.pop("password")

        user = User.objects.create_user(
            password=password,
            **validated_data
        )

        return user


class LoginSerializer(serializers.Serializer):

    username = serializers.CharField()

    password = serializers.CharField(
        write_only=True
    )

    def validate(self, attrs):

        username = attrs.get("username")
        password = attrs.get("password")

        user = authenticate(
            username=username,
            password=password,
        )

        if user is None:
            raise serializers.ValidationError(
                "Invalid username or password."
            )

        if not user.is_active:
            raise serializers.ValidationError(
                "Your account is inactive."
            )

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