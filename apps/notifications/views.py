from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Notification
from .serializers import NotificationSerializer


class NotificationListView(
    generics.ListAPIView
):

    serializer_class = NotificationSerializer

    permission_classes = [
        IsAuthenticated
    ]

    def get_queryset(self):

        return Notification.objects.filter(
            user=self.request.user
        )


class NotificationReadView(
    generics.UpdateAPIView
):

    serializer_class = NotificationSerializer

    permission_classes = [
        IsAuthenticated
    ]

    def get_queryset(self):

        return Notification.objects.filter(
            user=self.request.user
        )

    def perform_update(self, serializer):

        serializer.save(
            is_read=True
        )