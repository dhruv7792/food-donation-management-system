
console.log("Donation JS loaded");

"use strict";

/* =========================================================
   HELPER: GET DONATION ID FROM URL
   ========================================================= */

function getDonationIdFromURL() {
    const match = window.location.pathname.match(
        /\/donor\/donations\/(\d+)\/?$/
    );

    return match ? match[1] : null;
}


/* =========================================================
   DONATION CREATE
   ========================================================= */

async function createDonation(event) {
    event.preventDefault();

    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);

    try {
        setButtonLoading(submitButton, true, "Publishing...");

        const response = await apiRequest("/api/v1/donations/", {
            method: "POST",
            body: formData
        });

        showMessage(
            "Donation published successfully! Redirecting to your donations...",
            "success",
            "donationBtnMessage"
        );
        showMessage(
            "Donation published successfully! Redirecting to your donations...",
            "success",
            "donationMessage"
        );

        form.reset();

        const preview = document.getElementById("imagePreview");
        if (preview) preview.innerHTML = "";

        setTimeout(function () {
            window.location.href = "/donor/donations/";
        }, 800);

        return response;

    } catch (error) {
        console.error("Create donation error:", error);
        const errorMsg = (typeof getApiErrorMessage === "function")
            ? getApiErrorMessage(error)
            : (error.message || "Unable to create donation.");

        showMessage(errorMsg, "danger", "donationBtnMessage");
        showMessage(errorMsg, "danger", "donationMessage");

    } finally {
        setButtonLoading(submitButton, false);
    }
}


/* =========================================================
   LOAD DONATIONS
   ========================================================= */

let donationCurrentPage = 1;

async function loadDonations(page = 1) {
    const table =
        document.getElementById("donationTableBody") ||
        document.getElementById("donationsTable");

    if (!table) return;

    try {
        const search = (
            document.getElementById("searchDonation") ||
            document.getElementById("donationSearch")
        )?.value || "";

        const category = (
            document.getElementById("filterCategory") ||
            document.getElementById("donationCategory")
        )?.value || "";

        const status = (
            document.getElementById("filterStatus") ||
            document.getElementById("donationStatus")
        )?.value || "";

        const params = new URLSearchParams();
        params.set("page", page);

        if (search) params.set("search", search);
        if (category) params.set("food_type", category);
        if (status) params.set("status", status);

        const response = await apiRequest(
            `/api/v1/donations/?${params.toString()}`
        );

        renderDonationTable(response);
        donationCurrentPage = page;
        updateDonationPagination(response);

    } catch (error) {
        console.error("Load donations error:", error);

        table.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-danger py-5">
                    <i class="bi bi-exclamation-triangle fs-3 d-block mb-2 text-warning"></i>
                    Unable to load donations.
                    <div class="mt-2">
                        <button class="btn btn-sm btn-outline-success" onclick="loadDonations(1)">
                            <i class="bi bi-arrow-clockwise me-1"></i> Retry
                        </button>
                    </div>
                </td>
            </tr>
        `;

        showMessage(error.message || "Unable to load donations.", "danger");
    }
}


/* =========================================================
   GET DONATION ARRAY FROM API RESPONSE
   ========================================================= */

function getDonationArray(response) {
    if (Array.isArray(response)) return response;
    if (response && Array.isArray(response.results)) return response.results;
    if (response && Array.isArray(response.data)) return response.data;
    if (response && response.data && Array.isArray(response.data.results)) return response.data.results;

    return [];
}


/* =========================================================
   RENDER DONATION TABLE
   ========================================================= */

function renderDonationTable(response) {
    const table =
        document.getElementById("donationTableBody") ||
        document.getElementById("donationsTable");

    if (!table) return;

    const donations = getDonationArray(response);

    if (donations.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-5 text-muted">
                    <i class="bi bi-inbox fs-2 text-muted d-block mb-2"></i>
                    No donations found.
                    <div class="mt-2">
                        <a href="/donor/donations/create/" class="btn btn-sm btn-success">
                            <i class="bi bi-plus-lg me-1"></i> New Donation
                        </a>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    table.innerHTML = donations.map(donation => {

        const imageURL = donation.image
            ? (donation.image.startsWith("http") ? donation.image : new URL(donation.image, window.location.origin).href)
            : "";

        const imageHTML = imageURL
            ? `
                <img
                    src="${escapeHTML(imageURL)}"
                    width="45"
                    height="45"
                    class="rounded object-fit-cover"
                    alt="Food"
                    onerror="this.style.display='none';"
                >
            `
            : `
                <div class="bg-light rounded d-flex align-items-center justify-content-center"
                     style="width:45px;height:45px;">
                    <i class="bi bi-image text-muted"></i>
                </div>
            `;

        const title = donation.title || donation.food_name || "-";
        const category = donation.food_type || donation.category || "-";
        const quantity = `${donation.quantity ?? "-"} ${donation.quantity_unit || donation.unit || ""}`;
        const expiryDate = formatDate(donation.expiry_at || donation.expiry_date);
        const createdDate = formatDate(donation.created_at);
        const donationStatus = donation.status || "AVAILABLE";

        return `
            <tr>
                <td>
                    <div class="d-flex align-items-center gap-2">
                        ${imageHTML}
                        <div>
                            <strong>${escapeHTML(title)}</strong>
                        </div>
                    </div>
                </td>

                <td>
                    <span class="badge bg-light text-dark border">
                        ${escapeHTML(category)}
                    </span>
                </td>

                <td>${escapeHTML(quantity)}</td>

                <td>${expiryDate}</td>

                <td>${statusBadge(donationStatus)}</td>

                <td><small class="text-muted">${createdDate}</small></td>

                <td>
                    <a href="/donor/donations/${encodeURIComponent(donation.id)}/"
                       class="btn btn-sm btn-outline-success">
                        <i class="bi bi-eye me-1"></i>View
                    </a>
                </td>
            </tr>
        `;
    }).join("");
}


/* =========================================================
   PAGINATION
   ========================================================= */

function updateDonationPagination(response) {
    const pagination =
        document.getElementById("donationPagination") ||
        document.getElementById("donationsPagination");

    const info = document.getElementById("paginationInfo");
    const donations = getDonationArray(response);
    const count = response?.count ?? response?.data?.count ?? donations.length;

    if (info) {
        info.textContent = `Showing ${donations.length} of ${count} donations`;
    }

    if (!pagination) return;

    if (Array.isArray(response) || count <= 10) {
        pagination.innerHTML = "";
        return;
    }

    const pageSize = 10;
    const totalPages = Math.ceil(count / pageSize);

    if (typeof renderPagination === "function") {
        renderPagination(
            pagination.id,
            donationCurrentPage,
            totalPages,
            "loadDonations"
        );
    }
}


/* =========================================================
   DELETE DONATION
   ========================================================= */

async function deleteDonation(donationId) {
    if (!confirmAction("Are you sure you want to delete this donation?")) {
        return;
    }

    try {
        await apiRequest(`/donations/${donationId}/`, {
            method: "DELETE"
        });

        showMessage("Donation deleted successfully.", "success");
        loadDonations(donationCurrentPage);

    } catch (error) {
        console.error("Delete donation error:", error);
        showMessage(error.message || "Unable to delete donation.", "danger");
    }
}


/* =========================================================
   LOAD DONATION DETAIL
   ========================================================= */

async function loadDonationDetail(donationId) {

    const container = document.getElementById("donationDetails");

    if (!container) {
        console.error("Donation details container not found.");
        return;
    }

    if (!donationId) {
        container.innerHTML =
            '<div class="alert alert-danger">Donation ID is missing.</div>';
        return;
    }

    function safeText(value) {
        const element = document.createElement("div");
        element.textContent = value ?? "-";
        return element.innerHTML;
    }

    function displayDate(value) {
        if (!value) return "-";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return safeText(value);
        }

        return safeText(date.toLocaleString());
    }

    try {
        container.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-success"></div>
                <p class="text-muted mt-3">Loading donation...</p>
            </div>
        `;

        console.log("Loading donation ID:", donationId);

        const data = await apiRequest(`/donations/${donationId}/`);

        console.log("Donation API response:", data);

        if (!data || !data.id) {
            throw new Error("Donation details were not found.");
        }

        // Convert API image path into a complete image URL.
        const imageURL = data.image
            ? new URL(data.image, window.location.origin).href
            : "";

        console.log("Donation image URL:", imageURL);

        const imageHTML = imageURL
            ? `
                <div class="text-center">
                    <img
                        src="${safeText(imageURL)}"
                        class="img-fluid rounded shadow-sm"
                        alt="${safeText(data.title || "Donation food")}"
                        style="width:100%; max-height:350px; object-fit:cover;"
                        onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='block';"
                    >

                    <div class="alert alert-warning mt-2" style="display:none;">
                        Food image could not be loaded.
                    </div>
                </div>
            `
            : `
                <div class="bg-light rounded text-center py-5">
                    <i class="bi bi-image fs-1 text-secondary"></i>
                    <p class="text-muted mb-0">No image uploaded.</p>
                </div>
            `;

        container.innerHTML = `
            <div class="card border-0 shadow-sm">
                <div class="card-body p-4">

                    <div class="row g-4">

                        <div class="col-md-5">
                            ${imageHTML}
                        </div>

                        <div class="col-md-7">

                            <h2 class="text-success mb-3">
                                ${safeText(data.title)}
                            </h2>

                            <p class="text-muted">
                                Donation ID: ${safeText(data.id)}
                            </p>

                            <hr>

                            <h5>Donation Information</h5>

                            <div class="row mb-3">
                                <div class="col-sm-5 fw-semibold">Food Type</div>
                                <div class="col-sm-7">${safeText(data.food_type)}</div>
                            </div>

                            <div class="row mb-3">
                                <div class="col-sm-5 fw-semibold">Quantity</div>
                                <div class="col-sm-7">
                                    ${safeText(data.quantity)} ${safeText(data.quantity_unit)}
                                </div>
                            </div>

                            <div class="row mb-3">
                                <div class="col-sm-5 fw-semibold">Status</div>
                                <div class="col-sm-7">
                                    <span class="badge bg-success">
                                        ${safeText(data.status)}
                                    </span>
                                </div>
                            </div>

                            <div class="row mb-3">
                                <div class="col-sm-5 fw-semibold">Prepared At</div>
                                <div class="col-sm-7">${displayDate(data.prepared_at)}</div>
                            </div>

                            <div class="row mb-3">
                                <div class="col-sm-5 fw-semibold">Expiry At</div>
                                <div class="col-sm-7">${displayDate(data.expiry_at)}</div>
                            </div>

                            <div class="row mb-3">
                                <div class="col-sm-5 fw-semibold">Pickup Start</div>
                                <div class="col-sm-7">${displayDate(data.pickup_start)}</div>
                            </div>

                            <div class="row mb-3">
                                <div class="col-sm-5 fw-semibold">Pickup End</div>
                                <div class="col-sm-7">${displayDate(data.pickup_end)}</div>
                            </div>

                            <hr>

                            <h5>Description</h5>
                            <p>${safeText(data.description)}</p>

                            <hr>

                            <h5>Pickup Address</h5>
                            <p class="mb-1">${safeText(data.address)}</p>

                            <p class="mb-1">
                                ${safeText(data.city)}, ${safeText(data.state)}
                            </p>

                            <p class="mb-0">
                                Pincode: ${safeText(data.pincode)}
                            </p>

                            <hr>

                            <p class="text-muted small mb-0">
                                Created: ${displayDate(data.created_at)}
                            </p>

                            ${String(data.status).toUpperCase() === "ACCEPTED" ? `
                                <div class="alert alert-success d-flex justify-content-between align-items-center mt-3 mb-0">
                                    <div>
                                        <i class="bi bi-box-seam me-1 text-success"></i>
                                        <strong>Pickup in Progress</strong>: Once the food is handed over, complete the pickup.
                                    </div>
                                    <button class="btn btn-sm btn-success ms-2 text-nowrap" onclick="handleDonationComplete(${data.id})">
                                        <i class="bi bi-check-circle-fill me-1"></i> Complete Pickup
                                    </button>
                                </div>
                            ` : ""}

                        </div>
                    </div>
                </div>
            </div>
        `;

        console.log("Donation details loaded:", data);

    } catch (error) {
        console.error("Donation details error:", error);

        container.innerHTML = `
            <div class="alert alert-danger">
                Unable to load donation details:
                ${safeText(error.message || "Please try again.")}
            </div>
        `;
    }
}

async function handleDonationComplete(donationId) {
    if (!confirm("Are you sure you want to mark this food donation as picked up and completed?")) return;
    try {
        await apiRequest(`/api/v1/donations/${donationId}/complete/`, {
            method: "POST"
        });
        showMessage("Food donation pickup completed successfully!", "success", "detailMessage");
        setTimeout(() => window.location.reload(), 700);
    } catch (e) {
        console.error("Donation complete error:", e);
        showMessage(e.message || "Failed to complete donation.", "danger", "detailMessage");
    }
}


/* =========================================================
   FILTER EVENTS
   ========================================================= */

function initializeDonationList() {

    const search =
        document.getElementById("searchDonation") ||
        document.getElementById("donationSearch");

    const category =
        document.getElementById("filterCategory") ||
        document.getElementById("donationCategory");

    const status =
        document.getElementById("filterStatus") ||
        document.getElementById("donationStatus");

    const clearBtn = document.getElementById("clearFilters");

    const urlParams = new URLSearchParams(window.location.search);
    const initialStatus = urlParams.get("status");
    const initialCategory = urlParams.get("category");

    if (initialStatus && status) {
        const lowerStatus = initialStatus.toLowerCase();
        for (const opt of status.options) {
            if (opt.value.toLowerCase() === lowerStatus) {
                status.value = opt.value;
                break;
            }
        }
    }

    if (initialCategory && category) {
        const lowerCat = initialCategory.toLowerCase();
        for (const opt of category.options) {
            if (opt.value.toLowerCase() === lowerCat) {
                category.value = opt.value;
                break;
            }
        }
    }

    if (search) {
        let timeout;

        search.addEventListener("input", function () {
            clearTimeout(timeout);
            timeout = setTimeout(() => loadDonations(1), 400);
        });
    }

    [category, status].filter(Boolean).forEach(element => {
        element.addEventListener("change", () => {
            const url = new URL(window.location);
            if (status && status.value) {
                url.searchParams.set("status", status.value);
            } else {
                url.searchParams.delete("status");
            }
            if (category && category.value) {
                url.searchParams.set("category", category.value);
            } else {
                url.searchParams.delete("category");
            }
            window.history.replaceState({}, document.title, url.toString());
            loadDonations(1);
        });
    });

    if (clearBtn) {
        clearBtn.addEventListener("click", function (e) {
            e.preventDefault();
            if (search) search.value = "";
            if (category) category.value = "";
            if (status) status.value = "";
            // Also update URL without refresh
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
            loadDonations(1);
        });
    }

    loadDonations(1);
}


/* =========================================================
   IMAGE PREVIEW + DONATION FORM
   ========================================================= */

function initializeDonationCreate() {

    const form = document.getElementById("donationForm");

    if (form) {
        form.addEventListener("submit", createDonation);
    }

    setupImagePreview("foodImage", "imagePreview");

    const todayStr = new Date().toISOString().split("T")[0];

    const expiryInput = document.getElementById("expiryDate");

    if (expiryInput) {
        expiryInput.min = todayStr;

        if (!expiryInput.value) {
            const nextDay = new Date();
            nextDay.setDate(nextDay.getDate() + 2);
            expiryInput.value = nextDay.toISOString().split("T")[0];
        }
    }

    const pickupInput = document.getElementById("pickupDate");

    if (pickupInput) {
        pickupInput.min = todayStr;

        if (!pickupInput.value) {
            pickupInput.value = todayStr;
        }
    }
}


/* =========================================================
   RECEIVER DONATIONS & DETAIL
   ========================================================= */

function getReceiverDonationIdFromURL() {
    const match = window.location.pathname.match(
        /\/receiver\/donations\/(\d+)\/?$/
    );
    return match ? match[1] : null;
}

async function loadReceiverDonationDetail() {
    const container = document.getElementById("receiverDonationDetail");
    if (!container) return;

    // If server already pre-rendered the content, keep it!
    if (container.querySelector(".detail-card") || container.querySelector("#requestFoodForm")) {
        return;
    }

    const donationId = getReceiverDonationIdFromURL();
    if (!donationId) return;

    try {
        const response = await apiRequest(`/api/v1/donations/${donationId}/`);
        const donation = response.data || response;
        if (!donation) return;

        const title = escapeHTML(donation.title || "Food Donation");
        const category = escapeHTML(donation.food_type || donation.category || "Food");
        const description = escapeHTML(donation.description || "Surplus food donation available for pickup.");
        const qty = `${donation.quantity || 0} ${escapeHTML(donation.quantity_unit || "")}`;
        const location = escapeHTML(`${donation.city || ""}${donation.pincode ? ", " + donation.pincode : ""}`);

        container.innerHTML = `
            <div class="row g-4">
                <div class="col-lg-8">
                    <div class="card border-0 shadow-sm detail-card mb-4">
                        <div class="card-body p-4">
                            <h3 class="fw-bold mb-2 text-dark">${title}</h3>
                            <span class="badge bg-success-subtle text-success border border-success-subtle px-3 py-2 text-uppercase mb-3">
                                ${category}
                            </span>
                            <p class="text-secondary mb-4">${description}</p>
                            <div class="p-3 bg-light rounded-3 mb-3">
                                <div>Quantity: <strong>${qty}</strong></div>
                                <div>Location: <strong>${location}</strong></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error("Error loading receiver donation detail:", error);
    }
}

function initializeReceiverDonations() {
    const search = document.getElementById("receiverSearch");
    const category = document.getElementById("receiverCategory");
    const sort = document.getElementById("receiverSort");
    const clearBtn = document.getElementById("clearReceiverFilters");

    function applyFilters() {
        const params = new URLSearchParams();
        if (search && search.value.trim()) params.set("search", search.value.trim());
        if (category && category.value) params.set("category", category.value);
        if (sort && sort.value) params.set("sort", sort.value);

        const newUrl = window.location.pathname + (params.toString() ? "?" + params.toString() : "");
        window.location.href = newUrl;
    }

    if (search) {
        search.addEventListener("keypress", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                applyFilters();
            }
        });
    }

    if (category) {
        category.addEventListener("change", applyFilters);
    }

    if (sort) {
        sort.addEventListener("change", applyFilters);
    }

    if (clearBtn) {
        clearBtn.addEventListener("click", function (e) {
            e.preventDefault();
            window.location.href = window.location.pathname;
        });
    }
}


/* =========================================================
   DOM READY
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    if (document.getElementById("donationForm")) {
        initializeDonationCreate();
    }

    if (document.getElementById("donationsTable") || document.getElementById("donationTableBody")) {
        initializeDonationList();
    }

    const donationId = getDonationIdFromURL();

    if (donationId) {
        loadDonationDetail(donationId);
    }

    if (document.getElementById("receiverDonationDetail")) {
        loadReceiverDonationDetail();
    }

    if (document.getElementById("receiverDonationsContainer")) {
        initializeReceiverDonations();
    }

});
