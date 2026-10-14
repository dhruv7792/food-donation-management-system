
"use strict";

/* =========================================================
   FOODSHARE - DONATION MANAGEMENT
   ========================================================= */

console.log("FoodShare donation.js loaded");

const DONATION_API = "/api/v1/donations/";
const DONOR_PROFILE_API = "/api/v1/auth/donor/profile/";
const REQUEST_API = "/api/v1/requests/";

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
    const container = document.getElementById("donationDetails");
    const message = document.getElementById("detailMessage");

    if (!container) return;

    // Read the ID from the URL, for example /donor/donations/3/
    if (!donationId) {
        const match = window.location.pathname.match(
            /\/donations\/(\d+)\/?$/
        );

        donationId = match ? match[1] : null;
    }

    if (!donationId) {
        container.innerHTML = `
            <div class="alert alert-danger">
                Donation ID could not be found in the page URL.
            </div>
        `;
        return;
    }

    try {
        const response = await apiRequest(
            `${DONATION_API}${encodeURIComponent(donationId)}/`
        );

        const donation = response?.data ?? response;

        if (!donation || !donation.id) {
            throw new Error("Donation details were not found.");
        }

        const address = [
            donation.address,
            donation.city,
            donation.state,
            donation.pincode
        ].filter(Boolean).join(", ");

        container.innerHTML = `
            <div class="card border-0 shadow-sm">
                <div class="card-body p-4">
                    <div class="d-flex justify-content-between
                                align-items-start flex-wrap gap-3 mb-4">
                        <div>
                            <h2 class="fw-bold text-success">
                                ${escapeHTML(donation.title || "Food donation")}
                            </h2>
                            <p class="text-muted mb-0">
                                Donation ID: ${escapeHTML(donation.id)}
                            </p>
                        </div>
                        ${statusBadge(donation.status)}
                    </div>

                    ${donation.image ? `
                        <img
                            src="${escapeHTML(donation.image)}"
                            alt="${escapeHTML(donation.title || "Food donation")}"
                            class="img-fluid rounded mb-4"
                            style="max-height:350px;width:100%;object-fit:cover;">
                    ` : ""}

                    <div class="row g-4">
                        <div class="col-md-6">
                            <h6 class="text-muted">Food Category</h6>
                            <p>${escapeHTML(donation.food_type || "Other")}</p>
                        </div>

                        <div class="col-md-6">
                            <h6 class="text-muted">Quantity</h6>
                            <p>
                                ${escapeHTML(donation.quantity ?? "-")}
                                ${escapeHTML(donation.quantity_unit || "")}
                            </p>
                        </div>

                        <div class="col-md-6">
                            <h6 class="text-muted">Expiry Date</h6>
                            <p>${formatDate(donation.expiry_at)}</p>
                        </div>

                        <div class="col-md-6">
                            <h6 class="text-muted">Prepared Date</h6>
                            <p>${formatDate(donation.prepared_at)}</p>
                        </div>

                        <div class="col-12">
                            <h6 class="text-muted">Description</h6>
                            <p>
                                ${escapeHTML(
            donation.description ||
            "No description provided."
        )}
                            </p>
                        </div>

                        <div class="col-12">
                            <h6 class="text-muted">Pickup Address</h6>
                            <p>${escapeHTML(address || "Address unavailable")}</p>
                        </div>

                        <div class="col-12">
                            <h6 class="text-muted">Pickup Window</h6>
                            <p>
                                ${formatDate(donation.pickup_start)}
                                –
                                ${formatDate(donation.pickup_end)}
                            </p>
                        </div>
                    </div>

                    <a href="/donor/donations/"
                       class="btn btn-outline-success mt-3">
                        <i class="bi bi-arrow-left me-1"></i>
                        Back to Donations
                    </a>
                </div>
            </div>
        `;

        if (message) {
            message.innerHTML = "";
        }

    } catch (error) {
        console.error("Donation detail error:", error);

        container.innerHTML = `
            <div class="alert alert-danger">
                ${escapeHTML(
            error.message ||
            "Unable to load donation details."
        )}
            </div>
        `;
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



/* =========================================================
   RECEIVER: BROWSE AVAILABLE DONATIONS
   ========================================================= */

let receiverCurrentPage = 1;

function initializeReceiverDonations() {
    const container = document.getElementById("receiverDonationsContainer");

    if (!container) return;

    const search = document.getElementById("receiverSearch");
    const category = document.getElementById("receiverCategory");
    const sort = document.getElementById("receiverSort");
    const clearButton = document.getElementById("clearReceiverFilters");

    let searchTimer;

    if (search) {
        search.addEventListener("input", () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => loadReceiverDonations(1), 350);
        });
    }

    if (category) {
        category.addEventListener("change", () => loadReceiverDonations(1));
    }

    if (sort) {
        sort.addEventListener("change", () => loadReceiverDonations(1));
    }

    if (clearButton) {
        clearButton.addEventListener("click", () => {
            if (search) search.value = "";
            if (category) category.value = "";
            if (sort) sort.value = "newest";
            loadReceiverDonations(1);
        });
    }

    loadReceiverDonations(1);
}

async function loadReceiverDonations(page = 1) {
    const container = document.getElementById("receiverDonationsContainer");
    if (!container) return;

    container.innerHTML = `
        <div class="col-12 text-center py-5">
            <div class="spinner-border text-success"></div>
            <p class="mt-3 text-muted">Loading available donations...</p>
        </div>
    `;

    try {
        const params = new URLSearchParams();
        const search = document.getElementById("receiverSearch")?.value.trim() || "";
        const category = document.getElementById("receiverCategory")?.value || "";
        const sort = document.getElementById("receiverSort")?.value || "newest";

        params.set("page", page);

        if (search) params.set("search", search);

        // Match the backend's actual food_type choices.
        const categoryMap = {
            prepared: "OTHER",
            grains: "OTHER",
            vegetables: "OTHER",
            fruits: "FRUITS",
            bakery: "BAKERY",
            packaged: "PACKAGED",
            other: "OTHER"
        };

        if (category) {
            params.set("food_type", categoryMap[category] || category.toUpperCase());
        }

        params.set("ordering", sort === "expiry" ? "expiry_at" : "-created_at");

        const response = await apiRequest(
            `${DONATION_API}available/?${params.toString()}`
        );

        const donations = Array.isArray(response)
            ? response
            : Array.isArray(response?.data)
                ? response.data
                : Array.isArray(response?.results)
                    ? response.results
                    : Array.isArray(response?.data?.results)
                        ? response.data.results
                        : [];

        renderReceiverDonations(donations);

        const count = Number(
            response?.count ??
            response?.data?.count ??
            donations.length
        );

        const info = document.getElementById("receiverPaginationInfo");
        if (info) {
            info.textContent = `Showing ${count} donation${count === 1 ? "" : "s"}`;
        }

        const pagination = document.getElementById("receiverPagination");
        if (pagination) {
            pagination.innerHTML = "";

            const pageSize = donations.length || 10;
            const totalPages = Math.ceil(count / pageSize);

            if (totalPages > 1) {
                pagination.innerHTML = `
                    <li class="page-item ${page <= 1 ? "disabled" : ""}">
                        <button class="page-link" type="button"
                            ${page <= 1 ? "disabled" : ""}
                            onclick="loadReceiverDonations(${page - 1})">
                            Previous
                        </button>
                    </li>
                    <li class="page-item disabled">
                        <span class="page-link">Page ${page} of ${totalPages}</span>
                    </li>
                    <li class="page-item ${page >= totalPages ? "disabled" : ""}">
                        <button class="page-link" type="button"
                            ${page >= totalPages ? "disabled" : ""}
                            onclick="loadReceiverDonations(${page + 1})">
                            Next
                        </button>
                    </li>
                `;
            }
        }

        receiverCurrentPage = page;

    } catch (error) {
        console.error("Could not load receiver donations:", error);

        container.innerHTML = `
            <div class="col-12">
                <div class="alert alert-danger">
                    ${escapeHTML(error.message || "Unable to load available donations.")}
                </div>
            </div>
        `;

        const info = document.getElementById("receiverPaginationInfo");
        if (info) info.textContent = "Unable to load donations";

        const pagination = document.getElementById("receiverPagination");
        if (pagination) pagination.innerHTML = "";
    }
}

function renderReceiverDonations(donations) {
    const container = document.getElementById("receiverDonationsContainer");
    if (!container) return;

    if (!donations.length) {
        container.innerHTML = `
            <div class="col-12">
                <div class="card border-0 shadow-sm">
                    <div class="card-body text-center py-5">
                        <i class="bi bi-basket display-4 text-muted"></i>
                        <h5 class="mt-3">No food donations available</h5>
                        <p class="text-muted mb-0">
                            Please try another search or check again later.
                        </p>
                    </div>
                </div>
            </div>
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

    container.innerHTML = donations.map(donation => {
        const title = donation.title || "Food donation";
        const image = donation.image;
        const foodType = categoryLabels[donation.food_type] || donation.food_type || "Other";

        return `
            <div class="col-md-6 col-xl-4">
                <div class="card h-100 border-0 shadow-sm">
                    ${image
                ? `<img src="${escapeHTML(image)}"
                                class="card-img-top"
                                alt="${escapeHTML(title)}"
                                style="height:220px;object-fit:cover;">`
                : `<div class="bg-light d-flex align-items-center justify-content-center"
                                style="height:220px;">
                                <i class="bi bi-basket display-3 text-secondary"></i>
                               </div>`
            }

                    <div class="card-body d-flex flex-column">
                        <span class="badge text-bg-success align-self-start mb-2">
                            ${escapeHTML(foodType)}
                        </span>

                        <h5 class="card-title">${escapeHTML(title)}</h5>

                        <p class="card-text text-muted">
                            ${escapeHTML(donation.description || "No description provided.")}
                        </p>

                        <p class="mb-2">
                            <i class="bi bi-box-seam me-2 text-success"></i>
                            <strong>Quantity:</strong>
                            ${escapeHTML(donation.quantity ?? "-")}
                            ${escapeHTML(donation.quantity_unit || "")}
                        </p>

                        <p class="mb-2">
                            <i class="bi bi-calendar-event me-2 text-success"></i>
                            <strong>Expires:</strong>
                            ${formatDate(donation.expiry_at)}
                        </p>

                        <p class="mb-3">
                            <i class="bi bi-geo-alt me-2 text-success"></i>
                            ${escapeHTML(donation.city || "Location unavailable")},
                            ${escapeHTML(donation.state || "")}
                        </p>

                        <div class="mt-auto">
                            <a href="/receiver/donations/${encodeURIComponent(donation.id)}/"
                               class="btn btn-success w-100">
                                <i class="bi bi-eye me-1"></i>
                                View Donation
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join("");
}



/* =========================================================
   RECEIVER: DONATION DETAILS
   ========================================================= */

async function loadReceiverDonationDetail(donationId) {
    const container = document.getElementById(
        "receiverDonationDetail"
    );

    const message = document.getElementById(
        "receiverDonationMessage"
    );

    if (!container) return;

    // Extract ID from /receiver/donations/2/
    if (!donationId) {
        const match = window.location.pathname.match(
            /\/receiver\/donations\/(\d+)\/?$/
        );

        donationId = match ? match[1] : null;
    }

    if (!donationId) {
        container.innerHTML = `
            <div class="alert alert-danger">
                Donation ID could not be found in the URL.
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-success"></div>
            <p class="text-muted mt-3">Loading donation details...</p>
        </div>
    `;

    try {
        const response = await apiRequest(
            `${DONATION_API}${encodeURIComponent(donationId)}/`
        );

        const donation = response?.data ?? response;

        if (!donation || !donation.id) {
            throw new Error("Donation details were not found.");
        }

        const address = [
            donation.address,
            donation.city,
            donation.state,
            donation.pincode
        ].filter(Boolean).join(", ");

        container.innerHTML = `
            <div class="card border-0 shadow-sm">
                <div class="card-body p-4 p-md-5">

                    <div class="d-flex justify-content-between
                                align-items-start flex-wrap gap-3 mb-4">
                        <div>
                            <h2 class="fw-bold text-success">
                                ${escapeHTML(donation.title || "Food donation")}
                            </h2>
                            <p class="text-muted">
                                Donation ID: ${escapeHTML(donation.id)}
                            </p>
                        </div>

                        ${statusBadge(donation.status)}
                    </div>

                    ${donation.image ? `
                        <img
                            src="${escapeHTML(donation.image)}"
                            alt="${escapeHTML(donation.title || "Food donation")}"
                            class="img-fluid rounded mb-4"
                            style="width:100%;max-height:350px;object-fit:cover;">
                    ` : ""}

                    <div class="row g-4">
                        <div class="col-md-6">
                            <h6 class="text-muted">Food Category</h6>
                            <p>${escapeHTML(donation.food_type || "Other")}</p>
                        </div>

                        <div class="col-md-6">
                            <h6 class="text-muted">Quantity</h6>
                            <p>
                                ${escapeHTML(donation.quantity ?? "-")}
                                ${escapeHTML(donation.quantity_unit || "")}
                            </p>
                        </div>

                        <div class="col-md-6">
                            <h6 class="text-muted">Expiry Date</h6>
                            <p>${formatDate(donation.expiry_at)}</p>
                        </div>

                        <div class="col-md-6">
                            <h6 class="text-muted">Prepared Date</h6>
                            <p>${formatDate(donation.prepared_at)}</p>
                        </div>

                        <div class="col-12">
                            <h6 class="text-muted">Description</h6>
                            <p>
                                ${escapeHTML(
            donation.description ||
            "No description provided."
        )}
                            </p>
                        </div>

                        <div class="col-12">
                            <h6 class="text-muted">Pickup Address</h6>
                            <p>${escapeHTML(address || "Address unavailable")}</p>
                        </div>

                        <div class="col-md-6">
                            <h6 class="text-muted">Pickup Starts</h6>
                            <p>${formatDate(donation.pickup_start)}</p>
                        </div>

                        <div class="col-md-6">
                            <h6 class="text-muted">Pickup Ends</h6>
                            <p>${formatDate(donation.pickup_end)}</p>
                        </div>
                    </div>

                    <div class="mt-4">
                        <a href="/receiver/donations/"
                           class="btn btn-outline-success">
                            <i class="bi bi-arrow-left me-1"></i>
                            Back to Available Food
                        </a>
                    </div>

                </div>
            </div>
        `;

        if (message) {
            message.textContent = "";
            message.className = "d-none";
        }

        initializeFoodRequestForm(donation);

    } catch (error) {
        console.error(
            "Receiver donation detail error:",
            error
        );

        container.innerHTML = `
            <div class="alert alert-danger">
                ${escapeHTML(
            error.message ||
            "Unable to load donation details."
        )}
            </div>
        `;
    }
}



/* =========================================================
   RECEIVER: SUBMIT FOOD REQUEST
   ========================================================= */

function initializeFoodRequestForm(donation) {
    const form = document.getElementById("foodRequestForm");

    if (!form || form.dataset.initialized === "true") {
        return;
    }

    form.dataset.initialized = "true";

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const messageBox = document.getElementById(
            "receiverDonationMessage"
        );

        const submitButton = document.getElementById(
            "submitFoodRequest"
        );

        const quantityInput = document.getElementById(
            "requested_quantity"
        );

        const requestedQuantity = Number(quantityInput.value);

        if (
            !Number.isFinite(requestedQuantity) ||
            requestedQuantity <= 0
        ) {
            showReceiverRequestMessage(
                "Enter a quantity greater than zero.",
                "danger"
            );
            return;
        }

        if (requestedQuantity > Number(donation.quantity)) {
            showReceiverRequestMessage(
                "Requested quantity cannot exceed the available quantity.",
                "danger"
            );
            return;
        }

        setButtonLoading(submitButton, true, "Submitting...");

        try {
            const payload = {
                donation: donation.id,
                requested_quantity: requestedQuantity,
                message: document.getElementById(
                    "request_message"
                ).value.trim()
            };

            const response = await apiRequest(REQUEST_API, {
                method: "POST",
                body: JSON.stringify(payload)
            });

            showReceiverRequestMessage(
                response.message || "Food request submitted successfully!",
                "success"
            );

            form.reset();

            // Prevent another request from this page after success.
            form.innerHTML = `
                <div class="alert alert-success mb-0">
                    <i class="bi bi-check-circle me-2"></i>
                    Your request has been submitted.
                    You can check its status in My Requests.
                </div>
            `;

        } catch (error) {
            console.error("Food request error:", error);

            showReceiverRequestMessage(
                error.message || "Unable to submit your food request.",
                "danger"
            );

        } finally {
            if (submitButton && submitButton.isConnected) {
                setButtonLoading(submitButton, false);
            }
        }
    });
}

function showReceiverRequestMessage(message, type = "info") {
    const container = document.getElementById(
        "receiverDonationMessage"
    );

    if (!container) {
        alert(message);
        return;
    }

    container.textContent = message;
    container.className = `alert alert-${type}`;
    container.classList.remove("d-none");

    container.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
}

