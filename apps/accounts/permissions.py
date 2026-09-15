from rest_framework.permissions import BasePermission

from .models import User


class IsDonor(BasePermission):

    message = "Only donors can perform this action."

    def has_permission(self, request, view):

        return (
            request.user.is_authenticated
            and request.user.role == User.Role.DONOR
        )


class IsReceiver(BasePermission):

    message = "Only receivers can perform this action."

    def has_permission(self, request, view):

        return (
            request.user.is_authenticated
            and request.user.role == User.Role.RECEIVER
        )


class IsAdministrator(BasePermission):

    message = "Only administrators can perform this action."

    def has_permission(self, request, view):

        return (
            request.user.is_authenticated
            and (
                request.user.role == User.Role.ADMIN
                or request.user.is_staff
            )
        )


class IsOwner(BasePermission):

    message = "You do not have permission to access this resource."

    def has_object_permission(
        self,
        request,
        view,
        obj
    ):

        return obj.user == request.user