from django.urls import path

from .views import (
    RegisterView,
    LoginView,
    LogoutView,
    MeView,
    DonorProfileView,
    ReceiverProfileView,
    UserProfileView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
)


urlpatterns = [

    path(
        "register/",
        RegisterView.as_view(),
        name="api-register",
    ),

    path(
        "login/",
        LoginView.as_view(),
        name="api-login",
    ),

    path(
        "logout/",
        LogoutView.as_view(),
        name="api-logout",
    ),

    path(
        "me/",
        MeView.as_view(),
        name="me",
    ),

    path(
        "profile/",
        UserProfileView.as_view(),
        name="user-profile",
    ),

    path(
        "donor/profile/",
        DonorProfileView.as_view(),
        name="donor-profile",
    ),

    path(
        "receiver/profile/",
        ReceiverProfileView.as_view(),
        name="receiver-profile",
    ),

    # Password Reset
    path(
        "password-reset/",
        PasswordResetRequestView.as_view(),
        name="password-reset",
    ),

    path(
        "password-reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="password-reset-confirm",
    ),
]
