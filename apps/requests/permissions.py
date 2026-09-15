from rest_framework.permissions import BasePermission

from apps.accounts.models import User


class IsReceiver(BasePermission):

    message = "Only receivers can request food."

    def has_permission(
        self,
        request,
        view
    ):

        return (
            request.user.is_authenticated
            and request.user.role == User.Role.RECEIVER
        )


class IsDonationOwner(BasePermission):

    message = "Only the donor can manage this request."

    def has_object_permission(
        self,
        request,
        view,
        obj
    ):

        return (
            obj.donation.donor
            == request.user
        )