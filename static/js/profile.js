
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("profileForm");
    if (!form) return;

    const message = document.getElementById("profileMessage");
    const saveButton = document.getElementById("saveProfileBtn");
    const imageInput = document.getElementById("profile_image");
    const imagePreview = document.getElementById("imagePreview");

    const token = localStorage.getItem("access_token");
    let user = {};

    try {
        user = JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
        user = {};
    }

    if (!token) {
        showMessage("Please log in to view your profile.", "danger");
        return;
    }

    const role = String(user.role || "DONOR").toUpperCase();

    const apiUrl = role === "DONOR"
        ? "/api/v1/auth/donor/profile/"
        : role === "RECEIVER"
            ? "/api/v1/auth/receiver/profile/"
            : null;

    if (!apiUrl) {
        showMessage("This page is only available to donors and receivers.", "danger");
        return;
    }

    function showMessage(text, type = "danger") {
        if (!message) return;

        message.textContent = text;
        message.className = `alert alert-${type}`;
        message.classList.remove("d-none");
    }

    async function apiRequest(method, body = null) {
        const headers = {
            Authorization: `Bearer ${token}`,
            Accept: "application/json"
        };

        const options = {
            method,
            headers
        };

        if (body instanceof FormData) {
            options.body = body;
        } else if (body !== null) {
            headers["Content-Type"] = "application/json";
            options.body = JSON.stringify(body);
        }

        const response = await fetch(apiUrl, options);
        const text = await response.text();

        let result = {};

        try {
            result = text ? JSON.parse(text) : {};
        } catch {
            result = { detail: text || "Unexpected server response." };
        }

        console.log("Profile API:", apiUrl, response.status);

        if (response.status === 401) {
            throw new Error("Your session has expired. Please log in again.");
        }

        if (!response.ok) {
            const errors = result.errors || result;
            const detail = result.detail || result.message;

            throw new Error(
                detail ||
                (typeof errors === "object"
                    ? JSON.stringify(errors)
                    : String(errors)) ||
                "Unable to process your profile request."
            );
        }

        return result;
    }

    async function loadProfile() {
        try {
            const result = await apiRequest("GET");
            const profile = result.data || result;

            // Personal information
            setValue("first_name", profile.first_name || user.first_name || "");
            setValue("last_name", profile.last_name || user.last_name || "");
            setValue("email", profile.email || user.email || "");
            setValue("phone_no", profile.phone_no || profile.phone || user.phone || "");

            // Organization and location
            setValue("organization_name", profile.organization_name || "");
            setValue("address", profile.address || "");
            setValue("city", profile.city || "");
            setValue("state", profile.state || "");
            setValue("pincode", profile.pincode || "");

            const profileName = document.getElementById("profileName");
            const profileEmail = document.getElementById("profileEmail");

            if (profileName) {
                profileName.textContent =
                    `${profile.first_name || user.first_name || ""} ${
                        profile.last_name || user.last_name || ""
                    }`.trim() || user.username || "Donor";
            }

            if (profileEmail) {
                profileEmail.textContent = profile.email || user.email || "—";
            }

            if (imagePreview && profile.profile_image) {
                imagePreview.src = profile.profile_image;
                imagePreview.classList.remove("d-none");
            }
        } catch (error) {
            console.error("Profile loading failed:", error);
            showMessage(error.message, "danger");
        }
    }

    function setValue(fieldName, value) {
        const input = form.elements[fieldName];

        if (input) {
            input.value = value ?? "";
        }
    }

    if (imageInput && imagePreview) {
        imageInput.addEventListener("change", () => {
            const file = imageInput.files?.[0];

            if (!file) {
                imagePreview.removeAttribute("src");
                imagePreview.classList.add("d-none");
                return;
            }

            if (!file.type.startsWith("image/")) {
                showMessage("Please select a valid image.", "danger");
                imageInput.value = "";
                return;
            }

            imagePreview.src = URL.createObjectURL(file);
            imagePreview.classList.remove("d-none");
        });
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (saveButton) {
            saveButton.disabled = true;
            saveButton.textContent = "Saving...";
        }

        const payload = {};

        [
            "first_name",
            "last_name",
            "phone_no",
            "organization_name",
            "address",
            "city",
            "state",
            "pincode"
        ].forEach(field => {
            const input = form.elements[field];

            if (input) {
                payload[field] = input.value.trim();
            }
        });

        try {
            const imageFile = imageInput?.files?.[0];
            let result;

            if (imageFile) {
                const formData = new FormData();

                Object.entries(payload).forEach(([key, value]) => {
                    formData.append(key, value);
                });

                formData.append("profile_image", imageFile);

                result = await apiRequest("PUT", formData);
            } else {
                result = await apiRequest("PUT", payload);
            }

            showMessage(
                result.message || "Profile saved successfully.",
                "success"
            );

            // Refresh displayed profile data after saving.
            await loadProfile();
        } catch (error) {
            console.error("Profile saving failed:", error);
            showMessage(error.message, "danger");
        } finally {
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.innerHTML =
                    '<i class="bi bi-check-lg me-2"></i>Save Changes';
            }
        }
    });

    loadProfile();
});