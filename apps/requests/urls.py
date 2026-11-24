from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import FoodRequestViewSet


router = DefaultRouter()
router.register(
    "",
    FoodRequestViewSet,
    basename="food-request",
)

urlpatterns = [
    path(
        "requests/",
        FoodRequestViewSet.as_view({"get": "list", "post": "create"}),
        name="food-request-list-nested",
    ),
    path(
        "requests/<int:pk>/",
        FoodRequestViewSet.as_view({
            "get": "retrieve",
            "put": "update",
            "patch": "partial_update",
            "delete": "destroy",
        }),
        name="food-request-detail-nested",
    ),
    path(
        "requests/<int:pk>/accept/",
        FoodRequestViewSet.as_view({"post": "accept"}),
        name="food-request-accept-nested",
    ),
    path(
        "requests/<int:pk>/reject/",
        FoodRequestViewSet.as_view({"post": "reject"}),
        name="food-request-reject-nested",
    ),
    path(
        "requests/<int:pk>/cancel/",
        FoodRequestViewSet.as_view({"post": "cancel"}),
        name="food-request-cancel-nested",
    ),
] + router.urls
