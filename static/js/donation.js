"use strict";

console.log("FoodShare donation.js loaded");

const DONATION_API = "/api/v1/donations/";
const DONOR_PROFILE_API = "/api/v1/auth/donor/profile/";
const REQUEST_API = "/api/v1/requests/";

let donationCurrentPage = 1;
let receiverCurrentPage = 1;
let donationSearchTimer;
let receiverSearchTimer;

/* ------------------------- Common helpers ------------------------- */

function getAccessToken() {
    return localStorage.getItem("access_token") ||
        localStorage.getItem("access") ||
        sessionStorage.getItem("access_token") || "";
}

function getLoggedInUser() {
    try {
        return JSON.parse(localStorage.getItem("user") || "null");
    } catch (error) {
        console.error("Unable to read logged-in user:", error);
        return null;
    }
}

function getLoggedInRole() {
    return String(getLoggedInUser()?.role || "").toUpperCase();
}

async function apiRequest(url, options = {}) {
    const headers = new Headers(options.headers || {});
    const token = getAccessToken();

    headers.set("Accept", "application/json");

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
            message = data.detail || data.message ||
                Object.entries(data).map(([key, value]) =>
                    `${key}: ${
                        Array.isArray(value)
                            ? value.join(", ")
                            : typeof value === "object"
                                ? JSON.stringify(value)
                                : String(value)
                    }`
                ).join("\n") || message;
        } else if (typeof data === "string" && data.trim()) {
            message = `Server returned ${response.status}: ${data.slice(0, 250)}`;
        }

        if (response.status === 401) {
            message = "Your session may have expired. Please log in again.";
        }

        if (response.status === 403) {
            message = "You do not have permission to perform this action.";
        }

        throw new Error(message);
    }

    return data;
}

function unwrapData(response) {
    return response?.data ?? response;
}

function extractList(response) {
    const value = unwrapData(response);

    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.results)) return value.results;
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.data?.results)) return value.data.results;

    return [];
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

    return Number.isNaN(date.getTime())
        ? escapeHTML(value)
        : date.toLocaleDateString();
}

function statusBadge(status) {
    const value = String(status || "AVAILABLE").toUpperCase();

    const colors = {
        AVAILABLE: "success",
        REQUESTED: "warning",
        PENDING: "warning",
        ACCEPTED: "success",
        REJECTED: "danger",
        CANCELLED: "secondary",
        PICKED_UP: "info",
        COMPLETED: "success",
        EXPIRED: "secondary"
    };

    return `<span class="badge text-bg-${colors[value] || "secondary"}">${escapeHTML(value.replaceAll("_", " "))}</span>`;
}

function setButtonLoading(button, loading, text = "Please wait...") {
    if (!button) return;

    if (loading) {
        if (!button.dataset.originalText) {
            button.dataset.originalText = button.innerHTML;
        }

        button.disabled = true;

        button.innerHTML =
            `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${escapeHTML(text)}`;
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

function getDonationStatusFromURL() {
    const params = new URLSearchParams(window.location.search);

    return (params.get("status") || "").trim().toLowerCase();
}

function showMessage(elementId, message, type = "info") {
    const element = document.getElementById(elementId);

    if (!element) {
        alert(message);
        return;
    }

    element.textContent = message;
    element.className = `alert alert-${type}`;
    element.classList.remove("d-none");

    element.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
}

function showDonationMessage(message, type = "info") {
    showMessage("donationMessage", message, type);
}

function showReceiverRequestMessage(message, type = "info") {
    showMessage("receiverDonationMessage", message, type);
}

function showDetailMessage(message, type = "info") {
    showMessage("detailMessage", message, type);
}

/* ------------------------- Donor profile ------------------------- */

async function getDonorProfile() {
    try {
        return unwrapData(await apiRequest(DONOR_PROFILE_API));
    } catch (error) {
        console.error("Could not load donor profile:", error);

        throw new Error(
            "Unable to load your donor profile. Please check your profile and try again."
        );
    }
}

/* ------------------------- Create donation ------------------------- */

async function createDonation(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const button = form.querySelector(
        'button[type="submit"], button:not([type])'
    );

    if (!form.checkValidity()) {
        form.classList.add("was-validated");
        form.reportValidity();
        return;
    }

    const values = new FormData(form);
    const title = String(values.get("food_name") || "").trim();
    const quantity = Number(values.get("quantity"));
    const expiry = String(values.get("expiry_date") || "");
    const pickup = String(values.get("pickup_date") || "");

    if (!title) {
        return showDonationMessage("Please enter the food name.", "danger");
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
        return showDonationMessage(
            "Quantity must be greater than zero.",
            "danger"
        );
    }

    if (!expiry || !pickup) {
        return showDonationMessage(
            "Please enter expiry date and pickup date.",
            "danger"
        );
    }

    if (expiry < pickup) {
        return showDonationMessage(
            "Expiry date cannot be before pickup date.",
            "danger"
        );
    }

    setButtonLoading(button, true, "Publishing...");

    try {
        const profile = await getDonorProfile();

        const category = String(
            values.get("category") || "other"
        ).toLowerCase();

        const foodTypes = {
            bakery: "BAKERY",
            fruits: "FRUITS",
            packaged: "PACKAGED",
            other: "OTHER",
            prepared: "OTHER",
            grains: "OTHER",
            vegetables: "OTHER"
        };

        const units = {
            kg: "KG",
            g: "KG",
            litre: "LITER",
            liter: "LITER",
            ml: "LITER",
            packets: "PACKET",
            packet: "PACKET",
            plates: "PLATE",
            plate: "PLATE",
            pieces: "PIECE",
            piece: "PIECE"
        };

        const address = String(
            values.get("pickup_address") || profile.address || ""
        ).trim();

        const city = String(
            values.get("city") || profile.city || ""
        ).trim();

        const state = String(
            values.get("state") || profile.state || ""
        ).trim();

        const pincode = String(
            values.get("pincode") || profile.pincode || ""
        ).trim();

        if (!address || !city || !state || !pincode) {
            throw new Error(
                "Pickup address, city, state and pincode are required. Complete your donor profile first."
            );
        }

        const payload = new FormData();

        payload.append("title", title);
        payload.append(
            "description",
            String(values.get("description") || "")
        );
        payload.append("food_type", foodTypes[category] || "OTHER");
        payload.append("quantity", String(quantity));

        payload.append(
            "quantity_unit",
            units[String(values.get("unit") || "kg").toLowerCase()] || "KG"
        );

        payload.append("prepared_at", new Date().toISOString());
        payload.append("expiry_at", `${expiry}T23:59:00`);
        payload.append("pickup_start", `${pickup}T09:00:00`);
        payload.append("pickup_end", `${pickup}T17:00:00`);
        payload.append("address", address);
        payload.append("city", city);
        payload.append("state", state);
        payload.append("pincode", pincode);

        if (
            profile.latitude !== null &&
            profile.latitude !== undefined &&
            profile.latitude !== ""
        ) {
            payload.append("latitude", profile.latitude);
        }

        if (
            profile.longitude !== null &&
            profile.longitude !== undefined &&
            profile.longitude !== ""
        ) {
            payload.append("longitude", profile.longitude);
        }

        const image = values.get("image");

        if (image instanceof File && image.size) {
            payload.append("image", image);
        }

        const result = await apiRequest(DONATION_API, {
            method: "POST",
            body: payload
        });

        showDonationMessage(
            result?.message || "Donation published successfully!",
            "success"
        );

        form.reset();
        form.classList.remove("was-validated");

        document.getElementById("imagePreview")?.classList.add("d-none");
        document.getElementById("imagePreviewContainer")?.classList.add("d-none");

        window.setTimeout(() => {
            window.location.href = "/donor/donations/";
        }, 900);
    } catch (error) {
        console.error("Donation creation error:", error);

        showDonationMessage(
            error.message || "Unable to publish donation.",
            "danger"
        );
    } finally {
        setButtonLoading(button, false);
    }
}

function initializeDonationCreate() {
    const form = document.getElementById("donationForm");

    if (!form || form.dataset.initialized === "true") return;

    form.dataset.initialized = "true";
    form.addEventListener("submit", createDonation);

    const input = document.getElementById("foodImage");
    const preview = document.getElementById("imagePreview");
    const wrapper = document.getElementById("imagePreviewContainer");

    if (input && preview) {
        input.addEventListener("change", () => {
            const file = input.files?.[0];

            if (!file) {
                preview.removeAttribute("src");
                preview.classList.add("d-none");
                wrapper?.classList.add("d-none");
                return;
            }

            if (!file.type.startsWith("image/")) {
                showDonationMessage(
                    "Please select a valid image file.",
                    "danger"
                );

                input.value = "";
                return;
            }

            preview.src = URL.createObjectURL(file);
            preview.classList.remove("d-none");
            wrapper?.classList.remove("d-none");
        });
    }
}

/* ------------------------- Donor: My Donations ------------------------- */

async function loadDonations(page = 1) {
    const tbody = document.getElementById("donationTableBody");
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="text-center py-4">
                <span class="spinner-border spinner-border-sm text-success"></span>
                Loading donations...
            </td>
        </tr>
    `;

    try {
        const params = new URLSearchParams();

        const search =
            document.getElementById("searchDonation")?.value.trim() || "";

        const category =
            document.getElementById("filterCategory")?.value || "";

        const dropdown = document.getElementById("filterStatus");
        const urlStatus = getDonationStatusFromURL();

        const status = String(dropdown?.value || urlStatus || "")
            .trim()
            .toLowerCase();

        params.set("page", String(page));

        if (search) params.set("search", search);
        if (category) params.set("food_type", category);
        if (status) params.set("status", status);

        const response = await apiRequest(
            `${DONATION_API}my/?${params.toString()}`
        );

        renderDonationTable(response);

        donationCurrentPage = page;
        updateDonationPagination(response);
    } catch (error) {
        console.error("Loading donations failed:", error);

        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-danger py-4">
                    ${escapeHTML(error.message || "Unable to load donations.")}
                </td>
            </tr>
        `;

        const pagination = document.getElementById("donationPagination");
        if (pagination) pagination.innerHTML = "";

        const info = document.getElementById("paginationInfo");
        if (info) info.textContent = "Unable to load donations";
    }
}

function renderDonationTable(response) {
    const tbody = document.getElementById("donationTableBody");
    if (!tbody) return;

    const donations = extractList(response);

    if (!donations.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted py-5">
                    No donations found for this filter.
                </td>
            </tr>
        `;
        return;
    }

    const labels = {
        VEG: "Vegetarian",
        NON_VEG: "Non-Vegetarian",
        VEGAN: "Vegan",
        BAKERY: "Bakery",
        FRUITS: "Fruits",
        PACKAGED: "Packaged Food",
        OTHER: "Prepared Food"
    };

    tbody.innerHTML = donations.map(d => `
        <tr>
            <td>
                <div class="d-flex align-items-center gap-3">
                    ${
                        d.image
                            ? `<img src="${escapeHTML(d.image)}" width="64" height="64" class="rounded object-fit-cover" alt="${escapeHTML(d.title || "Food")}">`
                            : `<div class="bg-light rounded d-flex align-items-center justify-content-center" style="width:64px;height:64px"><i class="bi bi-image"></i></div>`
                    }
                    <strong>${escapeHTML(d.title || "-")}</strong>
                </div>
            </td>
            <td>${escapeHTML(labels[d.food_type] || d.food_type || "-")}</td>
            <td>${escapeHTML(d.quantity ?? "-")} ${escapeHTML(d.quantity_unit || "")}</td>
            <td>${formatDate(d.expiry_at)}</td>
            <td>${statusBadge(d.status)}</td>
            <td>${formatDate(d.created_at)}</td>
            <td>
                <a href="/donor/donations/${encodeURIComponent(d.id)}/"
                   class="btn btn-sm btn-outline-primary"
                   aria-label="View donation">
                    <i class="bi bi-eye"></i>
                </a>
                <button type="button"
                        class="btn btn-sm btn-outline-danger"
                        data-delete-donation="${Number(d.id)}"
                        aria-label="Delete donation">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join("");

    tbody.querySelectorAll("[data-delete-donation]").forEach(button => {
        button.addEventListener("click", () => {
            deleteDonation(button.dataset.deleteDonation);
        });
    });
}

function updateDonationPagination(response) {
    const pagination = document.getElementById("donationPagination");
    const info = document.getElementById("paginationInfo");

    const value = unwrapData(response);
    const donations = extractList(response);
    const count = Number(value?.count ?? donations.length);

    if (info) {
        info.textContent = count
            ? `Page ${donationCurrentPage} — ${count} matching donation(s)`
            : "No matching donations";
    }

    if (!pagination) return;

    pagination.innerHTML = "";

    const previous = value?.previous || null;
    const next = value?.next || null;

    if (!previous && !next) return;

    const prevButton = document.createElement("button");
    prevButton.type = "button";
    prevButton.className = "btn btn-outline-success btn-sm me-2";
    prevButton.textContent = "Previous";
    prevButton.disabled = !previous;

    prevButton.addEventListener("click", () => {
        if (previous) {
            loadDonations(Math.max(1, donationCurrentPage - 1));
        }
    });

    const label = document.createElement("span");
    label.textContent = `Page ${donationCurrentPage}`;

    const nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.className = "btn btn-outline-success btn-sm ms-2";
    nextButton.textContent = "Next";
    nextButton.disabled = !next;

    nextButton.addEventListener("click", () => {
        if (next) loadDonations(donationCurrentPage + 1);
    });

    pagination.append(prevButton, label, nextButton);
}

async function deleteDonation(id) {
    if (!confirmAction("Are you sure you want to delete this donation?")) {
        return;
    }

    try {
        await apiRequest(
            `${DONATION_API}${encodeURIComponent(id)}/`,
            { method: "DELETE" }
        );

        showDonationMessage("Donation deleted successfully.", "success");
        await loadDonations(donationCurrentPage);
    } catch (error) {
        showDonationMessage(
            error.message || "Unable to delete donation.",
            "danger"
        );
    }
}

function initializeDonationList() {
    const tbody = document.getElementById("donationTableBody");

    if (!tbody || tbody.dataset.initialized === "true") return;

    tbody.dataset.initialized = "true";

    const search = document.getElementById("searchDonation");
    const category = document.getElementById("filterCategory");
    const status = document.getElementById("filterStatus");
    const clear = document.getElementById("clearFilters");
    const urlStatus = getDonationStatusFromURL();

    if (status && urlStatus) {
        const option = [...status.options].find(
            option => option.value.trim().toLowerCase() === urlStatus
        );

        if (option) status.value = option.value;
    }

    search?.addEventListener("input", () => {
        clearTimeout(donationSearchTimer);
        donationSearchTimer = setTimeout(() => loadDonations(1), 350);
    });

    category?.addEventListener("change", () => loadDonations(1));
    status?.addEventListener("change", () => loadDonations(1));

    clear?.addEventListener("click", () => {
        if (search) search.value = "";
        if (category) category.value = "";
        if (status) status.value = "";

        history.replaceState({}, "", window.location.pathname);
        loadDonations(1);
    });

    loadDonations(1);
}

/* ------------------------- Donor: donation detail and requests ------------------------- */

async function loadDonationDetail(id) {
    const container = document.getElementById("donationDetails");
    if (!container) return;

    if (!id) {
        id = window.location.pathname.match(/\/donations\/(\d+)\/?$/)?.[1];
    }

    if (!id) {
        container.innerHTML =
            '<div class="alert alert-danger">Invalid donation ID.</div>';
        return;
    }

    container.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-success"></div>
            <p class="text-muted mt-3">Loading donation details...</p>
        </div>
    `;

    try {
        const d = unwrapData(
            await apiRequest(`${DONATION_API}${encodeURIComponent(id)}/`)
        );

        if (!d?.id) {
            throw new Error("Donation details were not found.");
        }

        const address = [
            d.address,
            d.city,
            d.state,
            d.pincode
        ].filter(Boolean).join(", ");

        container.innerHTML = `
            <div class="card border-0 shadow-sm">
                <div class="card-body p-4">
                    <div class="d-flex justify-content-between flex-wrap gap-3">
                        <div>
                            <h2 class="fw-bold text-success">
                                ${escapeHTML(d.title || "Food donation")}
                            </h2>
                            <p>Donation ID: ${escapeHTML(d.id)}</p>
                        </div>
                        ${statusBadge(d.status)}
                    </div>

                    ${
                        d.image
                            ? `<img src="${escapeHTML(d.image)}"
                                    class="img-fluid rounded mb-4"
                                    alt="${escapeHTML(d.title || "Food")}"
                                    style="max-height:350px;width:100%;object-fit:cover">`
                            : ""
                    }

                    <div class="row g-3">
                        <div class="col-md-6">
                            <h6>Food Category</h6>
                            <p>${escapeHTML(d.food_type || "Other")}</p>
                        </div>
                        <div class="col-md-6">
                            <h6>Quantity</h6>
                            <p>${escapeHTML(d.quantity ?? "-")} ${escapeHTML(d.quantity_unit || "")}</p>
                        </div>
                        <div class="col-md-6">
                            <h6>Expiry Date</h6>
                            <p>${formatDate(d.expiry_at)}</p>
                        </div>
                        <div class="col-md-6">
                            <h6>Prepared Date</h6>
                            <p>${formatDate(d.prepared_at)}</p>
                        </div>
                        <div class="col-12">
                            <h6>Description</h6>
                            <p>${escapeHTML(d.description || "No description provided.")}</p>
                        </div>
                        <div class="col-12">
                            <h6>Pickup Address</h6>
                            <p>${escapeHTML(address || "Address unavailable")}</p>
                        </div>
                        <div class="col-12">
                            <h6>Pickup Window</h6>
                            <p>${formatDate(d.pickup_start)} – ${formatDate(d.pickup_end)}</p>
                        </div>
                    </div>

                    <a href="/donor/donations/"
                       class="btn btn-outline-success mt-3">
                        Back to Donations
                    </a>

                    <section id="donorRequestSection"
                             class="mt-4 pt-4 border-top"></section>
                </div>
            </div>
        `;

        const message = document.getElementById("detailMessage");

        if (message) {
            message.textContent = "";
            message.className = "d-none";
        }

        if (
            getLoggedInRole() === "DONOR" &&
            location.pathname.includes("/donor/donations/")
        ) {
            await loadDonationRequestsForDonor(d.id);
        }
    } catch (error) {
        console.error("Donation detail error:", error);

        container.innerHTML = `
            <div class="alert alert-danger">
                ${escapeHTML(error.message || "Unable to load donation details.")}
            </div>
        `;
    }
}

async function loadDonationRequestsForDonor(donationId) {
    const section = document.getElementById("donorRequestSection");

    if (!section || getLoggedInRole() !== "DONOR") return;

    section.innerHTML =
        '<p class="text-center">Loading donation requests...</p>';

    try {
        const requests = extractList(
            await apiRequest(REQUEST_API)
        ).filter(request => {
            const linkedId = typeof request.donation === "object"
                ? request.donation?.id
                : request.donation;

            return Number(linkedId) === Number(donationId);
        });

        section.innerHTML = `
            <h4 class="text-success mb-3">Donation Requests</h4>
            <div id="donorRequestList"></div>
        `;

        const list = section.querySelector("#donorRequestList");

        if (!requests.length) {
            list.innerHTML = `
                <div class="alert alert-secondary">
                    No requests were found for this donation.
                </div>
            `;
            return;
        }

        list.innerHTML = requests.map(request => {
            const state = String(request.status || "PENDING").toUpperCase();

            const receiver = request.receiver_name ||
                request.receiver_username ||
                (typeof request.receiver === "object"
                    ? request.receiver?.username
                    : "") ||
                "Receiver";

            return `
                <div class="card mb-3">
                    <div class="card-body">
                        <div class="d-flex justify-content-between flex-wrap gap-2">
                            <div>
                                <h6>${escapeHTML(receiver)}</h6>
                                <p>Request ID: ${escapeHTML(request.id)}</p>
                                <p>Quantity requested: ${escapeHTML(request.requested_quantity ?? "-")}</p>
                                <p>Message: ${escapeHTML(request.message || "No message")}</p>
                            </div>
                            ${statusBadge(state)}
                        </div>

                        ${
                            state === "PENDING"
                                ? `<button type="button"
                                           class="btn btn-success me-2"
                                           data-action="accept"
                                           data-id="${Number(request.id)}">Accept</button>
                                   <button type="button"
                                           class="btn btn-outline-danger"
                                           data-action="reject"
                                           data-id="${Number(request.id)}">Reject</button>`
                                : ""
                        }
                    </div>
                </div>
            `;
        }).join("");

        list.querySelectorAll("[data-action]").forEach(button => {
            button.addEventListener("click", () => {
                handleDonorRequestAction(
                    button.dataset.id,
                    button.dataset.action,
                    donationId,
                    button
                );
            });
        });
    } catch (error) {
        section.innerHTML = `
            <div class="alert alert-danger">
                Could not load requests: ${escapeHTML(error.message)}
            </div>
        `;
    }
}

async function handleDonorRequestAction(
    requestId,
    action,
    donationId,
    button
) {
    if (!confirmAction(`Are you sure you want to ${action} this request?`)) {
        return;
    }

    setButtonLoading(button, true, "Processing...");

    try {
        const result = await apiRequest(
            `${REQUEST_API}${encodeURIComponent(requestId)}/${action}/`,
            { method: "POST" }
        );

        showDetailMessage(
            result?.message || `Request ${action}ed successfully.`,
            "success"
        );

        await loadDonationDetail(donationId);
    } catch (error) {
        showDetailMessage(
            error.message || `Unable to ${action} request.`,
            "danger"
        );

        setButtonLoading(button, false);
    }
}

/* ------------------------- Receiver: browse donations ------------------------- */

function initializeReceiverDonations() {
    const container = document.getElementById("receiverDonationsContainer");

    if (!container || container.dataset.initialized === "true") return;

    container.dataset.initialized = "true";

    const search = document.getElementById("receiverSearch");
    const category = document.getElementById("receiverCategory");
    const sort = document.getElementById("receiverSort");
    const clear = document.getElementById("clearReceiverFilters");

    search?.addEventListener("input", () => {
        clearTimeout(receiverSearchTimer);
        receiverSearchTimer = setTimeout(() => loadReceiverDonations(1), 350);
    });

    category?.addEventListener("change", () => loadReceiverDonations(1));
    sort?.addEventListener("change", () => loadReceiverDonations(1));

    clear?.addEventListener("click", () => {
        if (search) search.value = "";
        if (category) category.value = "";
        if (sort) sort.value = "newest";

        loadReceiverDonations(1);
    });

    loadReceiverDonations(1);
}

async function loadReceiverDonations(page = 1) {
    const container = document.getElementById("receiverDonationsContainer");
    if (!container) return;

    container.innerHTML = `
        <div class="col-12 text-center py-5">
            <div class="spinner-border text-success"></div>
            <p>Loading available donations...</p>
        </div>
    `;

    try {
        const params = new URLSearchParams();

        const search =
            document.getElementById("receiverSearch")?.value.trim() || "";

        const category =
            document.getElementById("receiverCategory")?.value || "";

        const sort =
            document.getElementById("receiverSort")?.value || "newest";

        params.set("page", String(page));

        if (search) params.set("search", search);

        const categories = {
            prepared: "OTHER",
            grains: "OTHER",
            vegetables: "OTHER",
            fruits: "FRUITS",
            bakery: "BAKERY",
            packaged: "PACKAGED",
            other: "OTHER"
        };

        if (category) {
            params.set(
                "food_type",
                categories[category] || category.toUpperCase()
            );
        }

        params.set(
            "ordering",
            sort === "expiry" ? "expiry_at" : "-created_at"
        );

        const response = await apiRequest(
            `${DONATION_API}available/?${params.toString()}`
        );

        const donations = extractList(response);

        renderReceiverDonations(donations);

        const value = unwrapData(response);
        const count = Number(value?.count ?? donations.length);

        const info = document.getElementById("receiverPaginationInfo");

        if (info) {
            info.textContent = `Showing ${donations.length} of ${count} donations`;
        }

        const pagination = document.getElementById("receiverPagination");

        if (pagination) {
            pagination.innerHTML = "";

            const previous = value?.previous;
            const next = value?.next;

            if (previous || next) {
                const prev = document.createElement("button");

                prev.type = "button";
                prev.className = "btn btn-outline-success btn-sm me-2";
                prev.textContent = "Previous";
                prev.disabled = !previous;

                prev.addEventListener("click", () => {
                    if (previous) {
                        loadReceiverDonations(Math.max(1, page - 1));
                    }
                });

                const label = document.createElement("span");
                label.textContent = `Page ${page}`;

                const nxt = document.createElement("button");

                nxt.type = "button";
                nxt.className = "btn btn-outline-success btn-sm ms-2";
                nxt.textContent = "Next";
                nxt.disabled = !next;

                nxt.addEventListener("click", () => {
                    if (next) loadReceiverDonations(page + 1);
                });

                pagination.append(prev, label, nxt);
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
    }
}

function renderReceiverDonations(donations) {
    const container = document.getElementById("receiverDonationsContainer");
    if (!container) return;

    if (!donations.length) {
        container.innerHTML = `
            <div class="col-12">
                <div class="card">
                    <div class="card-body text-center py-5">
                        <h5>No food donations available</h5>
                        <p class="text-muted">
                            Try another search or check again later.
                        </p>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    const labels = {
        VEG: "Vegetarian",
        NON_VEG: "Non-Vegetarian",
        VEGAN: "Vegan",
        BAKERY: "Bakery",
        FRUITS: "Fruits",
        PACKAGED: "Packaged Food",
        OTHER: "Prepared Food"
    };

    container.innerHTML = donations.map(donation => `
        <div class="col-md-6 col-xl-4">
            <div class="card h-100 border-0 shadow-sm">
                ${
                    donation.image
                        ? `<img src="${escapeHTML(donation.image)}"
                                class="card-img-top"
                                alt="${escapeHTML(donation.title || "Food")}"
                                style="height:220px;object-fit:cover">`
                        : `<div class="bg-light d-flex align-items-center justify-content-center"
                                style="height:220px">
                                <i class="bi bi-basket display-3"></i>
                           </div>`
                }

                <div class="card-body d-flex flex-column">
                    <span class="badge text-bg-success align-self-start mb-2">
                        ${escapeHTML(labels[donation.food_type] || donation.food_type || "Other")}
                    </span>

                    <h5>${escapeHTML(donation.title || "Food donation")}</h5>
                    <p class="text-muted">
                        ${escapeHTML(donation.description || "No description provided.")}
                    </p>

                    <p>
                        <strong>Quantity:</strong>
                        ${escapeHTML(donation.quantity ?? "-")}
                        ${escapeHTML(donation.quantity_unit || "")}
                    </p>

                    <p>
                        <strong>Expires:</strong>
                        ${formatDate(donation.expiry_at)}
                    </p>

                    <p>
                        <strong>Location:</strong>
                        ${escapeHTML(donation.city || "Unavailable")},
                        ${escapeHTML(donation.state || "")}
                    </p>

                    <a class="btn btn-success w-100 mt-auto"
                       href="/receiver/donations/${encodeURIComponent(donation.id)}/">
                        View Donation
                    </a>
                </div>
            </div>
        </div>
    `).join("");
}

/* ------------------------- Receiver: details and request form ------------------------- */

async function loadReceiverDonationDetail(id) {
    const container = document.getElementById("receiverDonationDetail");
    if (!container) return;

    if (!id) {
        id = location.pathname.match(
            /\/receiver\/donations\/(\d+)\/?$/
        )?.[1];
    }

    if (!id) {
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
            <p>Loading donation details...</p>
        </div>
    `;

    try {
        const d = unwrapData(
            await apiRequest(`${DONATION_API}${encodeURIComponent(id)}/`)
        );

        if (!d?.id) {
            throw new Error("Donation details were not found.");
        }

        const address = [
            d.address,
            d.city,
            d.state,
            d.pincode
        ].filter(Boolean).join(", ");

        const canRequest =
            String(d.status || "").toUpperCase() === "AVAILABLE";

        container.innerHTML = `
            <div class="card border-0 shadow-sm">
                <div class="card-body p-4">
                    <h2 class="text-success">
                        ${escapeHTML(d.title || "Food donation")}
                    </h2>

                    ${statusBadge(d.status)}

                    ${
                        d.image
                            ? `<img src="${escapeHTML(d.image)}"
                                    class="img-fluid rounded my-3"
                                    alt="${escapeHTML(d.title || "Food")}"
                                    style="width:100%;max-height:350px;object-fit:cover">`
                            : ""
                    }

                    <div class="row g-3 mt-1">
                        <div class="col-md-6">
                            <strong>Category:</strong>
                            ${escapeHTML(d.food_type || "Other")}
                        </div>

                        <div class="col-md-6">
                            <strong>Quantity:</strong>
                            ${escapeHTML(d.quantity ?? "-")}
                            ${escapeHTML(d.quantity_unit || "")}
                        </div>

                        <div class="col-md-6">
                            <strong>Expiry:</strong> ${formatDate(d.expiry_at)}
                        </div>

                        <div class="col-md-6">
                            <strong>Prepared:</strong> ${formatDate(d.prepared_at)}
                        </div>

                        <div class="col-12">
                            <strong>Description:</strong>
                            ${escapeHTML(d.description || "No description provided.")}
                        </div>

                        <div class="col-12">
                            <strong>Pickup address:</strong>
                            ${escapeHTML(address || "Address unavailable")}
                        </div>

                        <div class="col-md-6">
                            <strong>Pickup starts:</strong>
                            ${formatDate(d.pickup_start)}
                        </div>

                        <div class="col-md-6">
                            <strong>Pickup ends:</strong>
                            ${formatDate(d.pickup_end)}
                        </div>
                    </div>

                    <a href="/receiver/donations/"
                       class="btn btn-outline-success mt-3">
                        Back to Available Food
                    </a>

                    ${
                        canRequest
                            ? `<div class="card border-success mt-4">
                                <div class="card-body">
                                    <h4 class="text-success">Request This Food</h4>

                                    <form id="foodRequestForm">
                                        <div class="mb-3">
                                            <label for="requested_quantity"
                                                   class="form-label">
                                                Requested Quantity
                                            </label>

                                            <input type="number"
                                                   class="form-control"
                                                   id="requested_quantity"
                                                   min="0.01"
                                                   max="${Number(d.quantity)}"
                                                   step="any"
                                                   required>

                                            <small>
                                                Available: ${escapeHTML(d.quantity)}
                                                ${escapeHTML(d.quantity_unit || "")}
                                            </small>
                                        </div>

                                        <div class="mb-3">
                                            <label for="request_message"
                                                   class="form-label">
                                                Message to Donor (Optional)
                                            </label>

                                            <textarea class="form-control"
                                                      id="request_message"
                                                      rows="3"
                                                      maxlength="1000"></textarea>
                                        </div>

                                        <button id="submitFoodRequest"
                                                class="btn btn-success"
                                                type="submit">
                                            Submit Food Request
                                        </button>
                                    </form>
                                </div>
                            </div>`
                            : `<div class="alert alert-secondary mt-4">
                                This donation is not currently available for new requests.
                               </div>`
                    }
                </div>
            </div>
        `;

        initializeFoodRequestForm(d);
    } catch (error) {
        console.error("Receiver donation detail error:", error);

        container.innerHTML = `
            <div class="alert alert-danger">
                ${escapeHTML(error.message || "Unable to load donation details.")}
            </div>
        `;
    }
}

function initializeFoodRequestForm(donation) {
    const form = document.getElementById("foodRequestForm");

    if (!form || form.dataset.initialized === "true") return;

    form.dataset.initialized = "true";

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const button = document.getElementById("submitFoodRequest");

        const quantity = Number(
            document.getElementById("requested_quantity")?.value
        );

        if (!Number.isFinite(quantity) || quantity <= 0) {
            return showReceiverRequestMessage(
                "Enter a quantity greater than zero.",
                "danger"
            );
        }

        if (quantity > Number(donation.quantity)) {
            return showReceiverRequestMessage(
                "Requested quantity cannot exceed the available quantity.",
                "danger"
            );
        }

        setButtonLoading(button, true, "Submitting...");

        try {
            const result = await apiRequest(REQUEST_API, {
                method: "POST",
                body: JSON.stringify({
                    donation: donation.id,
                    requested_quantity: quantity,
                    message: document.getElementById("request_message")?.value.trim() || ""
                })
            });

            form.innerHTML = `
                <div class="alert alert-success mb-0">
                    ${escapeHTML(result?.message || "Food request submitted successfully!")}
                    Check My Requests for its status.
                </div>
            `;
        } catch (error) {
            console.error("Food request error:", error);

            showReceiverRequestMessage(
                error.message || "Unable to submit your food request.",
                "danger"
            );

            if (button?.isConnected) {
                setButtonLoading(button, false);
            }
        }
    });
}

/* ------------------------- Dashboard card navigation ------------------------- */

function initializeDonorDashboardCards() {
    document.querySelectorAll("[data-donation-status]").forEach(card => {
        if (card.dataset.navInitialized === "true") return;

        card.dataset.navInitialized = "true";

        card.addEventListener("click", event => {
            if (event.target.closest("a, button")) return;

            const status = String(
                card.dataset.donationStatus || ""
            ).trim().toLowerCase();

            location.href = status
                ? `/donor/donations/?status=${encodeURIComponent(status)}`
                : "/donor/donations/";
        });
    });
}

/* ------------------------- DOM ready ------------------------- */

document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("donationForm")) {
        initializeDonationCreate();
    }

    if (document.getElementById("donationTableBody")) {
        initializeDonationList();
    }

    if (document.getElementById("receiverDonationsContainer")) {
        initializeReceiverDonations();
    }

    // Donor donation detail: /donor/donations/6/
    const donorDetailContainer = document.getElementById("donationDetails");

    if (donorDetailContainer) {
        const match = window.location.pathname.match(
            /\/donor\/donations\/(\d+)\/?$/
        );

        if (match) {
            loadDonationDetail(match[1]);
        } else {
            donorDetailContainer.innerHTML = `
                <div class="alert alert-danger">
                    Invalid donation ID.
                </div>
            `;
        }
    }

    // Receiver donation detail: /receiver/donations/6/
    const receiverDetailContainer =
        document.getElementById("receiverDonationDetail");

    if (receiverDetailContainer) {
        const match = window.location.pathname.match(
            /\/receiver\/donations\/(\d+)\/?$/
        );

        if (match) {
            loadReceiverDonationDetail(match[1]);
        } else {
            receiverDetailContainer.innerHTML = `
                <div class="alert alert-danger">
                    Invalid donation ID.
                </div>
            `;
        }
    }

    initializeDonorDashboardCards();
});

