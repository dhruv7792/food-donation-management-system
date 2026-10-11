
from rest_framework.routers import SimpleRouter
from .views import DonationViewSet

router = SimpleRouter()
router.register(r"", DonationViewSet, basename="donation")

urlpatterns = router.urls