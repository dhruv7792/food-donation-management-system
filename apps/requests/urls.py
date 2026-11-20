from rest_framework.routers import DefaultRouter
from .views import FoodRequestViewSet

router = DefaultRouter()
router.register("", FoodRequestViewSet, basename="food-request")

urlpatterns = router.urls