from django.urls import path

from .views import (
    RegisterView,
    LoginView,
    LogoutView,
    MeView,
    DonorProfileView,
    ReceiverProfileView,
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
        "donor/profile/",
        DonorProfileView.as_view(),
        name="donor-profile",
    ),

    path(
        "receiver/profile/",
        ReceiverProfileView.as_view(),
        name="receiver-profile",
    ),
]