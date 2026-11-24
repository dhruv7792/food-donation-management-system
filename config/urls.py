
from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView

from apps.accounts.views import LoginPageView, RegisterPageView
from apps.dashboard.views import DonorDashboardPageView, ReceiverDashboardPageView
from apps.donations.views import (
    DonorDonationListView,
    DonationCreatePageView,
    ReceiverDonationListView,
    ReceiverDonationDetailPageView,
)
from apps.requests.views import DonorRequestListView, ReceiverRequestListView, ReceiverHistoryView


urlpatterns = [

    # =========================
    # ADMIN
    # =========================
    path("admin/", admin.site.urls),

    # =========================
    # PUBLIC PAGES
    # =========================
    path(
        "",
        TemplateView.as_view(template_name="public/home.html"),
        name="home",
    ),

    path(
        "about/",
        TemplateView.as_view(template_name="public/about.html"),
        name="about",
    ),

    path(
        "contact/",
        TemplateView.as_view(template_name="public/contact.html"),
        name="contact",
    ),

    # =========================
    # AUTH PAGES
    # =========================
    path(
        "login/",
        LoginPageView.as_view(),
        name="login",
    ),

    path(
        "register/",
        RegisterPageView.as_view(),
        name="register",
    ),

    path(
        "forgot-password/",
        TemplateView.as_view(template_name="auth/forgot_password.html"),
        name="forgot_password",
    ),
    path('api-auth/', include('rest_framework.urls')),
    # =========================
    # API
    # =========================
    path(
        "api/v1/auth/",
        include("apps.accounts.urls"),
    ),

    path(
        "api/v1/donations/",
        include("apps.donations.urls"),
    ),

    path(
        "api/v1/requests/",
        include("apps.requests.urls"),
    ),

    path(
        "api/v1/pickups/",
        include("apps.pickups.urls"),
    ),

    path(
        "api/v1/notifications/",
        include("apps.notifications.urls"),
    ),

    path(
        "api/v1/dashboard/",
        include("apps.dashboard.urls"),
    ),
    path(
        "dashboard/",
        include("apps.dashboard.urls"),
    ),
    path(
        "donations/",
        include("apps.donations.urls"),
    ),

    # =========================
    # DONOR FRONTEND
    # =========================
    path(
        "donor/",
        DonorDashboardPageView.as_view(),
        name="donor_dashboard",
    ),

    path(
        "donor/profile/",
        TemplateView.as_view(template_name="donor/profile.html"),
        name="donor_profile",
    ),

    path(
        "donor/donations/create/",
        DonationCreatePageView.as_view(),
        name="donor_create_donation",
    ),
    path(
        "donor/donations/new/",
        DonationCreatePageView.as_view(),
        name="donor_donation_create",
    ),

    path(
        "donor/donations/",
        DonorDonationListView.as_view(),
        name="donor_donation_list",
    ),

    path(
        "donor/donations/<int:donation_id>/",
        TemplateView.as_view(template_name="donor/donation_detail.html"),
        name="donor_donation_detail",
    ),

    path(
        "donor/requests/",
        DonorRequestListView.as_view(),
        name="donor_requests",
    ),

    # =========================
    # RECEIVER FRONTEND
    # =========================
    path(
        "receiver/",
        ReceiverDashboardPageView.as_view(),
        name="receiver_dashboard",
    ),

    path(
        "receiver/profile/",
        TemplateView.as_view(template_name="receiver/profile.html"),
        name="receiver_profile",
    ),

    path(
        "receiver/donations/",
        ReceiverDonationListView.as_view(),
        name="receiver_donations",
    ),

    path(
        "receiver/donations/<int:donation_id>/",
        ReceiverDonationDetailPageView.as_view(),
        name="receiver_donation_detail",
    ),

    path(
        "receiver/requests/",
        ReceiverRequestListView.as_view(),
        name="receiver_requests",
    ),

    path(
        "receiver/history/",
        ReceiverHistoryView.as_view(),
        name="receiver_history",
    ),

    # =========================
    # ADMIN FRONTEND
    # =========================
    path(
        "management/",
        TemplateView.as_view(template_name="admin/dashboard.html"),
        name="admin_dashboard",
    ),

    path(
        "management/users/",
        TemplateView.as_view(template_name="admin/users.html"),
        name="admin_users",
    ),

    path(
        "management/donations/",
        TemplateView.as_view(template_name="admin/donations.html"),
        name="admin_donations",
    ),

    path(
        "management/requests/",
        TemplateView.as_view(template_name="admin/requests.html"),
        name="admin_requests",
    ),

    path(
        "management/reports/",
        TemplateView.as_view(template_name="admin/reports.html"),
        name="admin_reports",
    ),
]


# =========================
# MEDIA FILES
# =========================
if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT,
    )