from rest_framework.routers import DefaultRouter
from .views import DonationViewSet


router = DefaultRouter()

router.register(
    "",
    DonationViewSet,
    basename="donation",
)

router.register(
    "donations",
    DonationViewSet,
    basename="donation-nested",
)


urlpatterns = router.urls