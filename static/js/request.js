
"use strict";

const FOOD_REQUEST_API = "/api/v1/requests/";

function requestToken() {
    return localStorage.getItem("access_token") ||
           localStorage.getItem("access") ||
           "";
}

async function requestApi(url, options = {}) {
    const token = requestToken();

    if (!token) {
        window.location.replace("/login/");
        throw new Error("Your session expired. Please log in again.");
    }

    const headers = {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {})
    };

    const response = await fetch(url, {
        ...options,
        headers,
        credentials: "same-origin"
    });

    const contentType = response.headers.get("content-type") || "";
    const result = contentType.includes("application/json")
        ? await response.json()
        : { message: await response.text() };

    if (response.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user");
        window.location.replace("/login/");
        throw new Error("Session expired. Please log in again.");
    }

    if (!response.ok) {
        const detail = result.message ||
            result.detail ||
            Object.entries(result)
                .map(([key, value]) =>
                    `${key}: ${Array.isArray(value) ? value.join(", ") : value}`
                )
                .join("; ");

        throw new Error(detail || `Request failed (${response.status}).`);
    }

    return result;
}

function requestArray(result) {
    if (Array.isArray(result)) return result;
    if (Array.isArray(result.results)) return result.results;
    if (Array.isArray(result.data)) return result.data;
    return [];
}

function requestEscape(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function requestStatus(status) {
    return String(status || "PENDING").toUpperCase();
}

function requestDate(value) {
    if (!value) return "—";

    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? requestEscape(value)
        : date.toLocaleString();
}

function requestMessage(elementId, message, type = "danger") {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.textContent = message;
    element.className = `alert alert-${type}`;
}

function getRequestUser() {
    try {
        return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
        return null;
    }
}

/* =========================
   RECEIVER: MY REQUESTS
========================= */

let receiverRequests = [];

async function initializeReceiverRequests() {
    const table = document.getElementById("receiverRequestTable");
    if (!table) return;

    table.innerHTML = `
        <tr><td colspan="6" class="text-center py-4">
            <span class="spinner-border spinner-border-sm"></span>
            Loading requests...
        </td></tr>`;

    try {
        const result = await requestApi(FOOD_REQUEST_API);
        receiverRequests = requestArray(result);

        renderReceiverRequests();
        requestMessage("receiverRequestMessage", "", "info");

        const message = document.getElementById("receiverRequestMessage");
        if (message) message.className = "d-none";
    } catch (error) {
        table.innerHTML = `
            <tr><td colspan="6" class="text-center text-danger py-4">
                ${requestEscape(error.message)}
            </td></tr>`;
        requestMessage("receiverRequestMessage", error.message);
        console.error("Loading receiver requests failed:", error);
    }

    const filter = document.getElementById("receiverRequestStatus");
    if (filter && filter.dataset.initialized !== "true") {
        filter.dataset.initialized = "true";
        filter.addEventListener("change", renderReceiverRequests);
    }
}

function renderReceiverRequests() {
    const table = document.getElementById("receiverRequestTable");
    if (!table) return;

    const filter = (
        document.getElementById("receiverRequestStatus")?.value || ""
    ).toUpperCase();

    const filtered = receiverRequests.filter(item =>
        !filter || requestStatus(item.status) === filter
    );

    document.getElementById("receiverTotalRequests").textContent =
        receiverRequests.length;

    document.getElementById("receiverPendingRequests").textContent =
        receiverRequests.filter(x => requestStatus(x.status) === "PENDING").length;

    document.getElementById("receiverApprovedRequests").textContent =
        receiverRequests.filter(x => requestStatus(x.status) === "ACCEPTED").length;

    document.getElementById("receiverRejectedRequests").textContent =
        receiverRequests.filter(x => requestStatus(x.status) === "REJECTED").length;

    if (!filtered.length) {
        table.innerHTML = `
            <tr><td colspan="6" class="text-center text-muted py-4">
                ${receiverRequests.length
                    ? "No requests match this filter."
                    : "You have not submitted any food requests yet."}
            </td></tr>`;
        return;
    }

    table.innerHTML = filtered.map(item => {
        const donation = item.donation;
        const food = item.donation_title ||
            (typeof donation === "object" ? donation.title : "") ||
            `Donation #${typeof donation === "object" ? donation.id : donation}`;

        const status = requestStatus(item.status);
        const badge = {
            PENDING: "warning",
            ACCEPTED: "success",
            REJECTED: "danger",
            CANCELLED: "secondary",
            COMPLETED: "primary"
        }[status] || "secondary";

        const cancelButton = status === "PENDING"
            ? `<button class="btn btn-sm btn-outline-danger"
                       data-cancel-request="${item.id}">Cancel</button>`
            : "—";

        return `
            <tr>
                <td>${requestEscape(food)}</td>
                <td>${requestEscape(item.donor_name || item.donor || "—")}</td>
                <td>${requestEscape(item.requested_quantity)}</td>
                <td><span class="badge text-bg-${badge}">
                    ${requestEscape(status)}
                </span></td>
                <td>${requestDate(item.requested_at)}</td>
                <td>${cancelButton}</td>
            </tr>`;
    }).join("");

    table.querySelectorAll("[data-cancel-request]").forEach(button => {
        button.addEventListener("click", () =>
            changeFoodRequest(button.dataset.cancelRequest, "cancel", "receiver")
        );
    });
}

/* =========================
   DONOR: INCOMING REQUESTS
========================= */

let donorRequests = [];

async function initializeDonorRequests() {
    const table = document.getElementById("requestTableBody");
    if (!table) return;

    table.innerHTML = `
        <tr><td colspan="7" class="text-center py-4">
            <span class="spinner-border spinner-border-sm"></span>
            Loading requests...
        </td></tr>`;

    try {
        const result = await requestApi(FOOD_REQUEST_API);
        donorRequests = requestArray(result);

        renderDonorRequests();

        const message = document.getElementById("requestMessage");
        if (message) message.className = "d-none";
    } catch (error) {
        table.innerHTML = `
            <tr><td colspan="7" class="text-center text-danger py-4">
                ${requestEscape(error.message)}
            </td></tr>`;
        requestMessage("requestMessage", error.message);
        console.error("Loading donor requests failed:", error);
    }

    const filter = document.getElementById("requestStatusFilter");
    if (filter && filter.dataset.initialized !== "true") {
        filter.dataset.initialized = "true";
        filter.addEventListener("change", renderDonorRequests);
    }
}

function renderDonorRequests() {
    const table = document.getElementById("requestTableBody");
    if (!table) return;

    const filter = (
        document.getElementById("requestStatusFilter")?.value || ""
    ).toUpperCase();

    const filtered = donorRequests.filter(item =>
        !filter || requestStatus(item.status) === filter
    );

    document.getElementById("totalRequests").textContent =
        donorRequests.length;

    document.getElementById("pendingRequests").textContent =
        donorRequests.filter(x => requestStatus(x.status) === "PENDING").length;

    document.getElementById("approvedRequests").textContent =
        donorRequests.filter(x => requestStatus(x.status) === "ACCEPTED").length;

    document.getElementById("rejectedRequests").textContent =
        donorRequests.filter(x => requestStatus(x.status) === "REJECTED").length;

    if (!filtered.length) {
        table.innerHTML = `
            <tr><td colspan="7" class="text-center text-muted py-4">
                ${donorRequests.length
                    ? "No requests match this filter."
                    : "No incoming requests found."}
            </td></tr>`;
        return;
    }

    table.innerHTML = filtered.map(item => {
        const donation = item.donation;
        const food = item.donation_title ||
            (typeof donation === "object" ? donation.title : "") ||
            `Donation #${typeof donation === "object" ? donation.id : donation}`;

        const status = requestStatus(item.status);
        const badge = {
            PENDING: "warning",
            ACCEPTED: "success",
            REJECTED: "danger",
            CANCELLED: "secondary",
            COMPLETED: "primary"
        }[status] || "secondary";

        const actions = status === "PENDING"
            ? `<button class="btn btn-sm btn-success me-1"
                       data-request-action="accept"
                       data-request-id="${item.id}">Accept</button>
               <button class="btn btn-sm btn-outline-danger"
                       data-request-action="reject"
                       data-request-id="${item.id}">Reject</button>`
            : "—";

        return `
            <tr>
                <td>${requestEscape(item.receiver_name || item.receiver || "—")}</td>
                <td>${requestEscape(food)}</td>
                <td>${requestEscape(item.requested_quantity)}</td>
                <td>${requestEscape(item.message || "—")}</td>
                <td><span class="badge text-bg-${badge}">
                    ${requestEscape(status)}
                </span></td>
                <td>${requestDate(item.requested_at)}</td>
                <td>${actions}</td>
            </tr>`;
    }).join("");

    table.querySelectorAll("[data-request-action]").forEach(button => {
        button.addEventListener("click", () =>
            changeFoodRequest(
                button.dataset.requestId,
                button.dataset.requestAction,
                "donor"
            )
        );
    });
}

/* =========================
   ACCEPT / REJECT / CANCEL
========================= */

async function changeFoodRequest(id, action, role) {
    const messageId = role === "donor"
        ? "requestMessage"
        : "receiverRequestMessage";

    const verb = action === "accept" ? "accept"
        : action === "reject" ? "reject" : "cancel";

    if (!confirm(`Are you sure you want to ${verb} this request?`)) return;

    try {
        await requestApi(
            `${FOOD_REQUEST_API}${encodeURIComponent(id)}/${action}/`,
            { method: "POST" }
        );

        requestMessage(
            messageId,
            `Food request ${action === "accept" ? "accepted" :
                action === "reject" ? "rejected" : "cancelled"} successfully.`,
            "success"
        );

        if (role === "donor") {
            await initializeDonorRequests();
        } else {
            await initializeReceiverRequests();
        }
    } catch (error) {
        requestMessage(messageId, error.message);
        console.error(`Request ${action} failed:`, error);
    }
}
