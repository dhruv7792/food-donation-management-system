
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("receiverProfileForm");
    if (!form) return;

    const message = document.getElementById("profileMessage");
    const saveButton = document.getElementById("saveReceiverProfileBtn");
    const token = localStorage.getItem("access_token");
    const user = JSON.parse(localStorage.getItem("user") || "null");

    if (!token || !user) {
        window.location.replace("/login/");
        return;
    }

    const apiUrl = "/api/v1/auth/receiver/profile/";

    function showMessage(text, type = "danger") {
        message.innerHTML = "";
        const alert = document.createElement("div");
        alert.className = `alert alert-${type}`;
        alert.textContent = text;
        message.appendChild(alert);
    }


    async function apiRequest(method, body = null) {
        const options = {
            method,
            headers: {
                Authorization: `Bearer ${token} `,
                Accept: "application/json"
            }
        };

        if (body !== null) {
            options.headers["Content-Type"] = "application/json";
            options.body = JSON.stringify(body);
        }

        console.log("Profile API URL:", apiUrl);
        console.log("Request method:", method);

        if (body !== null) {
            console.log("Request payload:", body);
        }

        const response = await fetch(apiUrl, options);
        const responseText = await response.text();

        let result;

        try {
            result = JSON.parse(responseText);
        } catch {
            result = { message: responseText };
        }

        console.log("Response status:", response.status);
        console.log("Response data:", result);

        if (response.status === 401) {
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
            localStorage.removeItem("user");
            window.location.replace("/login/");
            throw new Error("Session expired. Please log in again.");
        }

        if (!response.ok || result.success === false) {
            throw new Error(
                result.message ||
                JSON.stringify(result.errors || result) ||
                "Unable to update profile."
            );
        }

        return result.data || result;
    }


    async function loadProfile() {
        try {
            const profile = await apiRequest("GET");

            document.getElementById("firstName").value =
                profile.first_name || user.first_name || "";

            document.getElementById("lastName").value =
                profile.last_name || user.last_name || "";

            document.getElementById("email").value =
                profile.email || user.email || "";

            document.getElementById("phone").value =
                profile.phone_no || "";

            document.getElementById("address").value =
                profile.address || "";

            document.getElementById("profileEmail").textContent =
                profile.email || user.email || "—";

            document.getElementById("profileName").textContent =
                `${profile.first_name || user.first_name || ""} ${profile.last_name || user.last_name || ""
                    }`.trim() || "Receiver";

            message.innerHTML = "";
        } catch (error) {
            console.error("Receiver profile loading error:", error);
            showMessage(error.message);
        }
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();
        console.log("SAVE BUTTON CLICKED — form submit handler is running");
        console.log("Phone entered:", document.getElementById("phone").value);
        console.log("About to send PUT request");

        saveButton.disabled = true;
        saveButton.textContent = "Saving...";

        const payload = {
            first_name: document.getElementById("firstName").value.trim(),
            last_name: document.getElementById("lastName").value.trim(),
            phone_no: document.getElementById("phone").value.trim(),
            address: document.getElementById("address").value.trim()
        };

        try {
            await apiRequest("PUT", payload);
            showMessage("Profile updated successfully.", "success");
            await loadProfile();
        } catch (error) {
            console.error("Receiver profile saving error:", error);
            showMessage(error.message);
        } finally {
            saveButton.disabled = false;
            saveButton.innerHTML =
                '<i class="bi bi-check-lg me-2"></i> Save Changes';
        }
    });

    loadProfile();
});

