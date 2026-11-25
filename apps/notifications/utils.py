"""
Notification utilities for FoodShare.
Call these helper functions from views to create in-app notifications
for donors and receivers whenever something important happens.
"""

from .models import Notification


def _create(user, title, message, notification_type):
    """Internal helper — safely creates a Notification row."""
    if user is None:
        return
    try:
        Notification.objects.create(
            user=user,
            title=title,
            message=message,
            notification_type=notification_type,
        )
    except Exception:
        pass  # never crash the calling view over a notification


# ------------------------------------------------------------------
# DONOR notifications
# ------------------------------------------------------------------

def notify_donor_new_request(food_request):
    """
    Notify the donor when a receiver submits a new food request
    for one of their donations.
    """
    donation = food_request.donation
    receiver = food_request.receiver
    donor    = donation.donor

    receiver_name = (
        receiver.get_full_name().strip()
        or receiver.username
        or receiver.email.split("@")[0]
    ) if receiver else "Someone"

    _create(
        user=donor,
        title="🍽️ New Food Request Received",
        message=(
            f"{receiver_name} has requested your donation "
            f"'{donation.title}' "
            f"({food_request.requested_quantity} serving(s)). "
            f"Review and accept or reject it from your Requests page."
        ),
        notification_type=Notification.NotificationType.REQUEST,
    )


def notify_donor_request_cancelled(food_request):
    """Notify donor when a receiver cancels their pending request."""
    donation = food_request.donation
    receiver = food_request.receiver
    donor    = donation.donor

    receiver_name = (
        receiver.get_full_name().strip()
        or receiver.username
        or "The receiver"
    ) if receiver else "The receiver"

    _create(
        user=donor,
        title="❌ Food Request Cancelled",
        message=(
            f"{receiver_name} has cancelled their request for "
            f"'{donation.title}'. The donation is now available again."
        ),
        notification_type=Notification.NotificationType.REQUEST,
    )


def notify_donor_pickup_completed(food_request):
    """Notify donor when a pickup is marked completed."""
    donation = food_request.donation
    receiver = food_request.receiver
    donor    = donation.donor

    receiver_name = (
        receiver.get_full_name().strip()
        or receiver.username
        or "The receiver"
    ) if receiver else "The receiver"

    _create(
        user=donor,
        title="✅ Pickup Completed",
        message=(
            f"Great news! {receiver_name} has successfully collected "
            f"'{donation.title}'. Thank you for reducing food waste! 🌿"
        ),
        notification_type=Notification.NotificationType.COMPLETED,
    )


# ------------------------------------------------------------------
# RECEIVER notifications
# ------------------------------------------------------------------

def notify_receiver_request_accepted(food_request):
    """
    Notify the receiver when the donor accepts their food request.
    Includes the pickup code so they can collect the donation.
    """
    donation = food_request.donation
    donor    = donation.donor
    receiver = food_request.receiver

    donor_name = (
        donor.get_full_name().strip()
        or donor.username
        or "The donor"
    ) if donor else "The donor"

    pickup = getattr(food_request, "pickup", None)
    pickup_code_text = (
        f" Your pickup code is: {pickup.pickup_code}." if pickup else ""
    )

    _create(
        user=receiver,
        title="🎉 Your Request Has Been Accepted!",
        message=(
            f"{donor_name} has accepted your request for "
            f"'{donation.title}'.{pickup_code_text} "
            f"Please collect it from "
            f"{donation.address or donation.city or 'the donor location'} "
            f"before {donation.expiry_at.strftime('%d %b %Y, %I:%M %p') if donation.expiry_at else 'the expiry time'}."
        ),
        notification_type=Notification.NotificationType.ACCEPTED,
    )


def notify_receiver_request_rejected(food_request):
    """Notify receiver when donor rejects their request."""
    donation = food_request.donation
    donor    = donation.donor
    receiver = food_request.receiver

    donor_name = (
        donor.get_full_name().strip()
        or donor.username
        or "The donor"
    ) if donor else "The donor"

    _create(
        user=receiver,
        title="⛔ Request Not Accepted",
        message=(
            f"Unfortunately, {donor_name} could not accept your request for "
            f"'{donation.title}' at this time. "
            f"Browse other available donations — there's always more food to share! 🌱"
        ),
        notification_type=Notification.NotificationType.REJECTED,
    )


def notify_receiver_pickup_completed(food_request):
    """Notify receiver when pickup is confirmed completed."""
    donation = food_request.donation
    receiver = food_request.receiver

    _create(
        user=receiver,
        title="✅ Pickup Confirmed!",
        message=(
            f"Your pickup for '{donation.title}' has been successfully completed. "
            f"Thank you for being part of the FoodShare community! 🌍"
        ),
        notification_type=Notification.NotificationType.COMPLETED,
    )


def notify_receiver_new_donation_available(donation, receivers=None):
    """
    Notify all active receivers (or a specific list) when a new
    donation is published and available.
    """
    from apps.accounts.models import User

    if receivers is None:
        receivers = User.objects.filter(role=User.Role.RECEIVER, is_active=True)

    donor = donation.donor
    donor_name = (
        donor.get_full_name().strip()
        or donor.username
        or "A donor"
    ) if donor else "A donor"

    for receiver in receivers:
        _create(
            user=receiver,
            title="🆕 New Food Available Near You!",
            message=(
                f"{donor_name} just listed '{donation.title}' "
                f"({donation.quantity} serving(s), {donation.get_food_type_display() if hasattr(donation, 'get_food_type_display') else donation.food_type}). "
                f"Located in {donation.city or 'your area'}. "
                f"Available until "
                f"{donation.expiry_at.strftime('%d %b %Y, %I:%M %p') if donation.expiry_at else 'soon'}. "
                f"Request it now before it expires!"
            ),
            notification_type=Notification.NotificationType.SYSTEM,
        )
