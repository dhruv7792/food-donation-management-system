from rest_framework.routers import DefaultRouter
from .views import PickupViewSet


router = DefaultRouter()

router.register(
    "pickups",
    PickupViewSet,
    basename="pickup",
)

urlpatterns = router.urls