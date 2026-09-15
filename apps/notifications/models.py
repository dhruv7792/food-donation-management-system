from django.conf import settings
from django.db import models


class Notification(models.Model):

    class NotificationType(models.TextChoices):

        REQUEST = "REQUEST", "Food Request"
        ACCEPTED = "ACCEPTED", "Request Accepted"
        REJECTED = "REJECTED", "Request Rejected"
        PICKUP = "PICKUP", "Pickup"
        COMPLETED = "COMPLETED", "Completed"
        EXPIRY = "EXPIRY", "Expiry"
        SYSTEM = "SYSTEM", "System"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )

    title = models.CharField(
        max_length=200
    )

    message = models.TextField()

    notification_type = models.CharField(
        max_length=30,
        choices=NotificationType.choices,
    )

    is_read = models.BooleanField(
        default=False
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:

        ordering = [
            "-created_at"
        ]

    def __str__(self):

        return self.title
