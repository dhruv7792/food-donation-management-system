
"use strict";

/* =========================================================
   FOODSHARE - DONATION MANAGEMENT
   ========================================================= */

console.log("FoodShare donation.js loaded");

const DONATION_API = "/api/v1/donations/";
const DONOR_PROFILE_API = "/api/v1/auth/donor/profile/";

let donationCurrentPage = 1;

/* =========================================================
   COMMON HELPERS
   ========================================================= */

function getAccessToken() {
    return (
        localStorage.getItem("access_token") ||
        localStorage.getItem("access") ||
        ""
    );
}

async function apiRequest(url, options = {}) {
    const headers = new Headers(options.headers || {});
    const token = getAccessToken();

    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    if (
        options.body &&
        !(options.body instanceof FormData) &&
        !headers.has("Content-Type")
    ) {
        headers.set("Content-Type", "application/json");
    }

    const response = await fetch(url, {
        ...options,
        headers,
        credentials: "same-origin"
    });

    const contentType = response.headers.get("content-type") || "";
    let data = null;

    if (contentType.includes("application/json")) {
        data = await response.json();
    } else {
        data = await response.text();
    }

    if (!response.ok) {
        let message = "Request failed. Please try again.";

        if (data && typeof data === "object") {
            message =
                data.detail ||
                data.message ||
                Object.entries(data)
                    .map(([key, value]) => {
                        const text = Array.isArray(value)
                            ? value.join(", ")
                            : String(value);

                        return `${key}: ${text}`;
                    })
                    .join("\n") ||
                message;
        } else if (typeof data === "string" && data.trim()) {
            message = `Server error (${response.status}).`;
        }

        if (response.status === 401) {
            message =
                "Your session may have expired. Please log in again.";
        } else if (response.status === 403) {
            message =
                "You do not have permission to publish this donation.";
        }

        throw new Error(message);
    }

    return data;
}

function showDonationMessage(message, type = "info") {
    const container =
        document.getElementById("donationMessage");

    if (container) {
        container.textContent = message;
        container.className = `alert alert-${type}`;
        container.classList.remove("d-none");
        container.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });
        return;
    }

    alert(message);
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return escapeHTML(value);
    }

    return date.toLocaleDateString();
}

function statusBadge(status) {
    const normalized = String(status || "AVAILABLE").toUpperCase();

    const classes = {
        AVAILABLE: "success",
        REQUESTED: "warning",
        ACCEPTED: "primary",
        PICKED_UP: "info",
        COMPLETED: "success",
        EXPIRED: "secondary",
        CANCELLED: "danger"
    };

    const label = normalized.replaceAll("_", " ");

    return `
        <span class="badge text-bg-${classes[normalized] || "secondary"}">
            ${escapeHTML(label)}
        </span>
    `;
}

function setButtonLoading(button, loading, text = "Please wait...") {
    if (!button) return;

    if (loading) {
        button.dataset.originalText = button.innerHTML;
        button.disabled = true;
        button.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2"
                  aria-hidden="true"></span>
            ${escapeHTML(text)}
        `;
    } else {
        button.disabled = false;

        if (button.dataset.originalText) {
            button.innerHTML = button.dataset.originalText;
            delete button.dataset.originalText;
        }
    }
}

function confirmAction(message) {
    return window.confirm(message);
}

/* =========================================================
   DONOR PROFILE
   Get the donor's city, state and pincode for the donation.
   ========================================================= */


async function getDonorProfile() {
    try {
        const result = await apiRequest(DONOR_PROFILE_API);

        // The API returns profile details inside result.data.
        const profile = result?.data ?? result;

        console.log("Donor profile API response:", result);
        console.log("Donor profile details:", profile);

        return profile;
    } catch (error) {
        console.error("Could not load donor profile:", error);
        throw new Error(
            "Unable to load your donor profile. Please try again."
        );
    }
}

/* =========================================================
   CREATE DONATION
   ========================================================= */

async function createDonation(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const submitButton = form.querySelector(
        'button[type="submit"], button:not([type])'
    );

    if (!form.checkValidity()) {
        form.classList.add("was-validated");
        form.reportValidity();
        return;
    }

    const formData = new FormData(form);

    const foodName = String(
        formData.get("food_name") || ""
    ).trim();

    const quantity = Number(formData.get("quantity"));
    const expiryDate = String(
        formData.get("expiry_date") || ""
    );
    const pickupDate = String(
        formData.get("pickup_date") || ""
    );

    if (!foodName) {
        showDonationMessage("Please enter the food name.", "danger");
        return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
        showDonationMessage("Quantity must be greater than zero.", "danger");
        return;
    }

    if (!expiryDate || !pickupDate) {
        showDonationMessage(
            "Please enter both the expiry date and pickup date.",
            "danger"
        );
        return;
    }

    if (expiryDate < pickupDate) {
        showDonationMessage(
            "The expiry date cannot be before the pickup date.",
            "danger"
        );
        return;
    }

    setButtonLoading(submitButton, true, "Publishing...");

    try {
        const profile = await getDonorProfile();

        /*
         * Translate the HTML form fields into the Django
         * DonationSerializer field names.
         */
        const category = String(
            formData.get("category") || "other"
        ).toLowerCase();

        const foodTypeMap = {
            bakery: "BAKERY",
            fruits: "FRUITS",
            packaged: "PACKAGED",
            other: "OTHER",

            // The backend's food_type choices do not include
            // grains, vegetables or prepared as separate values.
            prepared: "OTHER",
            grains: "OTHER",
            vegetables: "OTHER"
        };

        const unitMap = {
            kg: "KG",
            litre: "LITER",
            packets: "PACKET",
            plates: "PLATE",
            pieces: "PIECE",

            // The backend does not define gram or millilitre units.
            g: "KG",
            ml: "LITER"
        };

        const unit = String(
            formData.get("unit") || "kg"
        ).toLowerCase();

        const address = String(
            formData.get("pickup_address") ||
            profile.address ||
            ""
        ).trim();

        const city = String(
            formData.get("city") ||
            profile.city ||
            ""
        ).trim();

        const state = String(
            formData.get("state") ||
            profile.state ||
            ""
        ).trim();

        const pincode = String(
            formData.get("pincode") ||
            profile.pincode ||
            ""
        ).trim();

        if (!address || !city || !state || !pincode) {
            throw new Error(
                "Pickup address, city, state and pincode are required. " +
                "Please complete your donor profile first."
            );
        }

        /*
         * The current HTML form only asks for dates, not pickup times.
         * These default times are used to provide a valid pickup window.
         * You can add actual time fields to the form later.
         */
        const pickupStart = `${pickupDate}T09:00:00`;
        const pickupEnd = `${pickupDate}T17:00:00`;

        const payload = new FormData();

        payload.append("title", foodName);
        payload.append("description", String(
            formData.get("description") || ""
        ));
        payload.append("food_type", foodTypeMap[category] || "OTHER");
        payload.append("quantity", String(quantity));
        payload.append("quantity_unit", unitMap[unit] || "KG");
        payload.append("prepared_at", new Date().toISOString());
        payload.append("expiry_at", `${expiryDate}T23:59:00`);
        payload.append("pickup_start", pickupStart);
        payload.append("pickup_end", pickupEnd);
        payload.append("address", address);
        payload.append("city", city);
        payload.append("state", state);
        payload.append("pincode", pincode);

        if (profile.latitude !== null &&
            profile.latitude !== undefined &&
            profile.latitude !== "") {
            payload.append("latitude", profile.latitude);
        }

        if (profile.longitude !== null &&
            profile.longitude !== undefined &&
            profile.longitude !== "") {
            payload.append("longitude", profile.longitude);
        }

        const image = formData.get("image");

        if (image instanceof File && image.size > 0) {
            payload.append("image", image);
        }

        console.log("Publishing donation to:", DONATION_API);

        const result = await apiRequest(DONATION_API, {
            method: "POST",
            body: payload
        });

        console.log("Donation created:", result);

        showDonationMessage(
            "Donation published successfully!",
            "success"
        );

        form.reset();
        form.classList.remove("was-validated");

        const preview = document.getElementById("imagePreview");
        const previewContainer = document.getElementById(
            "imagePreviewContainer"
        );

        if (preview) {
            preview.removeAttribute("src");
            preview.classList.add("d-none");
        }

        if (previewContainer) {
            previewContainer.classList.add("d-none");
        }

        setTimeout(() => {
            window.location.href = "/donor/donations/";
        }, 1000);

    } catch (error) {
        console.error("Donation creation error:", error);

        showDonationMessage(
            error.message || "Unable to publish donation.",
            "danger"
        );
    } finally {
        setButtonLoading(submitButton, false);
    }
}

/* =========================================================
   IMAGE PREVIEW
   ========================================================= */

function initializeDonationCreate() {
    const form = document.getElementById("donationForm");

    if (!form) return;

    if (form.dataset.donationInitialized === "true") return;

    form.dataset.donationInitialized = "true";
    form.addEventListener("submit", createDonation);

    const imageInput = document.getElementById("foodImage");
    const preview = document.getElementById("imagePreview");
    const previewContainer = document.getElementById(
        "imagePreviewContainer"
    );

    if (imageInput && preview) {
        imageInput.addEventListener("change", () => {
            const file = imageInput.files?.[0];

            if (!file) {
                preview.removeAttribute("src");
                preview.classList.add("d-none");

                if (previewContainer) {
                    previewContainer.classList.add("d-none");
                }

                return;
            }

            if (!file.type.startsWith("image/")) {
                showDonationMessage(
                    "Please select a valid image file.",
                    "danger"
                );

                imageInput.value = "";
                return;
            }

            preview.src = URL.createObjectURL(file);
            preview.classList.remove("d-none");

            if (previewContainer) {
                previewContainer.classList.remove("d-none");
            }
        });
    }
}

/* =========================================================
   LOAD DONATIONS
   ========================================================= */

async function loadDonations(page = 1) {
    const table =
        document.getElementById("donationsTable") ||
        document.getElementById("donationTableBody");

    if (!table) return;

    table.innerHTML = `
        <tr>
            <td colspan="8" class="text-center py-4">
                <span class="spinner-border spinner-border-sm text-success"></span>
                Loading donations...
            </td>
        </tr>
    `;

    try {
        const params = new URLSearchParams();
        params.set("page", page);

        const search = document.getElementById("donationSearch")?.value || "";
        const category = document.getElementById("donationCategory")?.value || "";
        const status = document.getElementById("donationStatus")?.value || "";

        if (search) params.set("search", search);
        if (category) params.set("food_type", category);
        if (status) params.set("status", status);

        const data = await apiRequest(
            `${DONATION_API}my/?${params.toString()}`
        );

        renderDonationTable(data);
        donationCurrentPage = page;
        updateDonationPagination(data);

    } catch (error) {
        console.error("Loading donations failed:", error);

        table.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-danger py-4">
                    ${escapeHTML(error.message || "Unable to load donations.")}
                </td>
            </tr>
        `;
    }
}

/* =========================================================
   RENDER DONATION TABLE
   ========================================================= */



function renderDonationTable(response) {
    const table =
        document.getElementById("donationsTable") ||
        document.getElementById("donationTableBody");

    if (!table) return;

    // Extract the donation list from FoodShare's API response.
    const donations = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
            ? response.data
            : Array.isArray(response?.results)
                ? response.results
                : Array.isArray(response?.data?.results)
                    ? response.data.results
                    : [];

    if (donations.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted py-5">
                    No donations found.
                </td>
            </tr>
        `;
        return;
    }

    const categoryLabels = {
        VEG: "Vegetarian",
        NON_VEG: "Non-Vegetarian",
        VEGAN: "Vegan",
        BAKERY: "Bakery",
        FRUITS: "Fruits",
        PACKAGED: "Packaged Food",
        OTHER: "Prepared Food"
    };

    table.innerHTML = donations.map(donation => {
        const title = donation.title || "-";
        const foodType = categoryLabels[donation.food_type]
            || donation.food_type
            || "-";
        const quantity = donation.quantity ?? "-";
        const unit = donation.quantity_unit || "";
        const image = donation.image;

        return `
            <tr>
                <td>
                    <div class="d-flex align-items-center gap-3">
                        ${image
                ? `<img
                                    src="${escapeHTML(image)}"
                                    width="64"
                                    height="64"
                                    class="rounded object-fit-cover"
                                    alt="${escapeHTML(title)}">`
                : `<div
                                    class="bg-light rounded d-flex
                                           align-items-center justify-content-center"
                                    style="width:64px;height:64px;">
                                    <i class="bi bi-image"></i>
                                   </div>`
            }
                        <strong>${escapeHTML(title)}</strong>
                    </div>
                </td>

                <td>${escapeHTML(foodType)}</td>

                <td>
                    ${escapeHTML(quantity)} ${escapeHTML(unit)}
                </td>

                <td>${formatDate(donation.expiry_at)}</td>

                <td>${statusBadge(donation.status)}</td>

                <td>${formatDate(donation.created_at)}</td>

                <td>
                    <a
                        href="/donor/donations/${encodeURIComponent(donation.id)}/"
                        class="btn btn-sm btn-outline-primary"
                        aria-label="View donation">
                        <i class="bi bi-eye"></i>
                    </a>

                    <button
                        type="button"
                        class="btn btn-sm btn-outline-danger"
                        onclick="deleteDonation(${Number(donation.id)})"
                        aria-label="Delete donation">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

/* =========================================================
   PAGINATION
   ========================================================= */


function updateDonationPagination(data) {
    const pagination = document.getElementById("donationsPagination");

    // Support both normal arrays and paginated API responses.
    const donations = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data?.results)
                ? data.results
                : Array.isArray(data?.data?.results)
                    ? data.data.results
                    : [];

    const totalCount = Array.isArray(data)
        ? data.length
        : Number(data?.count ?? data?.data?.count ?? donations.length);

    // Update the "Showing 0 donations" text.
    const countElement = Array.from(document.querySelectorAll("body *"))
        .find(element =>
            element.children.length === 0 &&
            /^Showing \d+ donations?$/.test(element.textContent.trim())
        );

    if (countElement) {
        countElement.textContent =
            `Showing ${totalCount} donation${totalCount === 1 ? "" : "s"}`;
    }

    if (!pagination) return;

    if (totalCount === 0) {
        pagination.innerHTML = "";
        return;
    }

    const pageSize = donations.length || 10;
    const totalPages = Math.ceil(totalCount / pageSize);

    if (totalPages <= 1) {
        pagination.innerHTML = "";
        return;
    }

    pagination.innerHTML = `
        <button type="button"
                class="btn btn-outline-success btn-sm me-2"
                ${donationCurrentPage <= 1 ? "disabled" : ""}
                onclick="loadDonations(${donationCurrentPage - 1})">
            Previous
        </button>

        <span>Page ${donationCurrentPage} of ${totalPages}</span>

        <button type="button"
                class="btn btn-outline-success btn-sm ms-2"
                ${donationCurrentPage >= totalPages ? "disabled" : ""}
                onclick="loadDonations(${donationCurrentPage + 1})">
            Next
        </button>
    `;
}

/* =========================================================
   DELETE DONATION
   ========================================================= */

async function deleteDonation(donationId) {
    if (!confirmAction("Are you sure you want to delete this donation?")) {
        return;
    }

    try {
        await apiRequest(`${DONATION_API}${donationId}/`, {
            method: "DELETE"
        });

        showDonationMessage("Donation deleted successfully.", "success");
        await loadDonations(donationCurrentPage);

    } catch (error) {
        showDonationMessage(
            error.message || "Unable to delete donation.",
            "danger"
        );
    }
}

/* =========================================================
   DONATION DETAILS
   ========================================================= */

async function loadDonationDetail(donationId) {
    try {
        const data = await apiRequest(
            `${DONATION_API}${donationId}/`
        );

        const elements = {
            name: document.getElementById("detailFoodName"),
            category: document.getElementById("detailCategory"),
            quantity: document.getElementById("detailQuantity"),
            status: document.getElementById("detailStatus"),
            description: document.getElementById("detailDescription"),
            expiry: document.getElementById("detailExpiry")
        };

        if (elements.name) {
            elements.name.textContent = data.title || "-";
        }

        if (elements.category) {
            elements.category.textContent = data.food_type || "-";
        }

        if (elements.quantity) {
            elements.quantity.textContent =
                `${data.quantity ?? "-"} ${data.quantity_unit || ""}`;
        }

        if (elements.status) {
            elements.status.innerHTML = statusBadge(data.status);
        }

        if (elements.description) {
            elements.description.textContent =
                data.description || "No description available.";
        }

        if (elements.expiry) {
            elements.expiry.textContent = formatDate(data.expiry_at);
        }

        return data;

    } catch (error) {
        console.error("Loading donation details failed:", error);
        showDonationMessage(
            error.message || "Unable to load donation details.",
            "danger"
        );
        return null;
    }
}

/* =========================================================
   FILTER EVENTS
   ========================================================= */

function initializeDonationList() {
    const search = document.getElementById("donationSearch");
    const category = document.getElementById("donationCategory");
    const status = document.getElementById("donationStatus");

    if (search) {
        let timeout;

        search.addEventListener("input", () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => loadDonations(1), 400);
        });
    }

    [category, status].filter(Boolean).forEach(element => {
        element.addEventListener("change", () => loadDonations(1));
    });

    loadDonations(1);
}

/* =========================================================
   DOM READY
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("donationForm")) {
        initializeDonationCreate();
    }

    if (
        document.getElementById("donationsTable") ||
        document.getElementById("donationTableBody")
    ) {
        initializeDonationList();
    }
});