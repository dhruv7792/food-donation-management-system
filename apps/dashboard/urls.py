from django.urls import path
from .views import (
    AdminDashboardView,
    DonorDashboardView,
    ReceiverDashboardView,
)


urlpatterns = [

    path(
        "admin/",
        AdminDashboardView.as_view(),
        name="admin-dashboard",
    ),

    path(
        "donor/",
        DonorDashboardView.as_view(),
        name="donor-dashboard",
    ),

    path(
        "receiver/",
        ReceiverDashboardView.as_view(),
        name="receiver-dashboard",
    ),
]