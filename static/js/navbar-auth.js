
document.addEventListener("DOMContentLoaded", () => {
    const guestItems = document.querySelectorAll(".auth-guest");
    const userItems = document.querySelectorAll(".auth-user");
    const profileLink = document.getElementById("profileNavLink");
    const logoutButton = document.getElementById("logoutButton");

    function clearAuthentication() {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user");
    }

    function updateNavbar() {
        let user = null;

        try {
            user = JSON.parse(localStorage.getItem("user") || "null");
        } catch {
            clearAuthentication();
        }

        const accessToken = localStorage.getItem("access_token");
        const isLoggedIn = Boolean(accessToken && user);

        guestItems.forEach(item => {
            item.classList.toggle("d-none", isLoggedIn);
        });

        userItems.forEach(item => {
            item.classList.toggle("d-none", !isLoggedIn);
        });

        
        if (profileLink && user) {
            const role = (user.role || "").toUpperCase();

            if (role === "DONOR") {
                profileLink.href = "/profile/";
            } else if (role === "RECEIVER") {
                 profileLink.href = "/receiver/profile/";
            } else {
                 profileLink.href = "#";
            }
}
    }

    updateNavbar();

    if (logoutButton) {
        logoutButton.addEventListener("click", async () => {
            logoutButton.disabled = true;
            logoutButton.textContent = "Signing out...";

            const accessToken = localStorage.getItem("access_token");
            const refreshToken = localStorage.getItem("refresh_token");

            try {
                const response = await fetch("/api/v1/auth/logout/", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        ...(accessToken
                            ? { "Authorization": `Bearer ${accessToken}` }
                            : {})
                    },
                    body: JSON.stringify({
                        refresh: refreshToken
                    })
                });

                if (!response.ok && response.status !== 401) {
                    throw new Error("Logout failed. Please try again.");
                }

                clearAuthentication();
                window.location.replace("/login/");
            } catch (error) {
                console.error("Logout error:", error);
                alert(error.message || "Unable to log out. Check your connection.");
                logoutButton.disabled = false;
                logoutButton.innerHTML =
                    '<i class="bi bi-box-arrow-right"></i> Logout';
            }
        });
    }
});