from django.urls import path

from .views import (
    NotificationListView,
    NotificationReadView,
    NotificationMarkAllReadView,
    NotificationUnreadCountView,
)


urlpatterns = [

    path(
        "",
        NotificationListView.as_view(),
        name="notifications",
    ),

    path(
        "unread-count/",
        NotificationUnreadCountView.as_view(),
        name="notification-unread-count",
    ),

    path(
        "mark-all-read/",
        NotificationMarkAllReadView.as_view(),
        name="notification-mark-all-read",
    ),

    path(
        "<int:pk>/read/",
        NotificationReadView.as_view(),
        name="notification-read",
    ),
]