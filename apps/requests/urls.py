from rest_framework.routers import DefaultRouter
from .views import FoodRequestViewSet


router = DefaultRouter()

router.register(
    "requests",
    FoodRequestViewSet,
    basename="food-request",
)

urlpatterns = router.urls