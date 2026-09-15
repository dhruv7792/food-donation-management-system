from rest_framework.permissions import BasePermission
from apps.accounts.models import User


class IsDonor(BasePermission):

    message = "Only donors can create donations."

    def has_permission(self, request, view):

        return (
            request.user.is_authenticated
            and request.user.role == User.Role.DONOR
        )


class IsDonationOwner(BasePermission):

    message = "You can only manage your own donations."

    def has_object_permission(
        self,
        request,
        view,
        obj
    ):

        return obj.donor == request.user