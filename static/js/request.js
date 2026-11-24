console.log("Request JS loaded");

"use strict";

/* =========================================================
   DONOR REQUESTS MANAGEMENT
   ========================================================= */

async function loadDonorRequests() {
    const tableBody = document.getElementById("requestTableBody");
    if (!tableBody) return;

    const filterStatus = document.getElementById("requestStatusFilter")?.value || "";

    try {
        let response = null;
        try {
            response = await apiRequest("/api/v1/requests/?donor=true");
        } catch (e) {
            try {
                response = await apiRequest("/api/v1/requests/");
            } catch (e2) {
                response = await apiRequest("/api/v1/requests/requests/");
            }
        }

        const requests = Array.isArray(response)
            ? response
            : (response.results || response.data || []);

        updateRequestStats(requests);

        const filtered = filterStatus
            ? requests.filter(r => (r.status || "").toLowerCase() === filterStatus.toLowerCase())
            : requests;

        renderRequestTable(filtered);

    } catch (error) {
        console.error("Load donor requests error:", error);
        // Only show message if table has no pre-rendered rows
        if (!tableBody.querySelector("tr td strong")) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted py-5">
                        <i class="bi bi-inbox fs-2 text-muted d-block mb-2"></i>
                        No donation requests found.
                    </td>
                </tr>
            `;
        }
    }
}

function updateRequestStats(requests) {
    if (!Array.isArray(requests)) return;

    const total = requests.length;
    const pending = requests.filter(r => (r.status || "").toUpperCase() === "PENDING").length;
    const approved = requests.filter(r => (r.status || "").toUpperCase() === "ACCEPTED").length;
    const rejected = requests.filter(r => (r.status || "").toUpperCase() === "REJECTED").length;

    const totalEl = document.getElementById("totalRequests");
    const pendingEl = document.getElementById("pendingRequests");
    const approvedEl = document.getElementById("approvedRequests");
    const rejectedEl = document.getElementById("rejectedRequests");

    if (totalEl) totalEl.textContent = total;
    if (pendingEl) pendingEl.textContent = pending;
    if (approvedEl) approvedEl.textContent = approved;
    if (rejectedEl) rejectedEl.textContent = rejected;
}

function renderRequestTable(requests) {
    const tableBody = document.getElementById("requestTableBody");
    if (!tableBody) return;

    if (!requests || requests.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-5 text-muted">
                    <i class="bi bi-inbox fs-2 text-muted d-block mb-2"></i>
                    No donation requests received yet.
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = requests.map(req => {
        const receiverName = escapeHTML(req.receiver_name || req.receiver?.username || req.receiver?.email || "-");
        const donationTitle = escapeHTML(req.donation_title || req.donation?.title || "-");
        const donationId = req.donation?.id || req.donation || "";
        const quantity = escapeHTML(String(req.requested_quantity || "-"));
        const message = escapeHTML(req.message || "-");
        const status = req.status || "PENDING";
        const date = formatDate(req.requested_at || req.created_at);

        let actionHtml = `<span class="text-muted small">-</span>`;
        const upperStatus = String(status).toUpperCase();

        if (upperStatus === "PENDING") {
            actionHtml = `
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-success" onclick="handleAcceptRequest(${req.id})">
                        <i class="bi bi-check-lg"></i> Accept
                    </button>
                    <button class="btn btn-outline-danger" onclick="handleRejectRequest(${req.id})">
                        <i class="bi bi-x-lg"></i> Reject
                    </button>
                </div>
            `;
        } else if (upperStatus === "ACCEPTED") {
            const codeBadge = req.pickup_code
                ? `<span class="badge bg-light text-dark border me-1" title="Pickup Verification Code"><i class="bi bi-upc-scan me-1"></i>${escapeHTML(req.pickup_code)}</span>`
                : "";
            actionHtml = `
                <div class="d-flex align-items-center gap-1">
                    ${codeBadge}
                    <button class="btn btn-sm btn-success" onclick="handleCompletePickup(${req.id})">
                        <i class="bi bi-check-circle-fill me-1"></i> Complete Pickup
                    </button>
                </div>
            `;
        } else if (upperStatus === "COMPLETED") {
            actionHtml = `
                <span class="badge bg-success-subtle text-success border border-success-subtle">
                    <i class="bi bi-check2-all me-1"></i> Completed
                </span>
            `;
        }

        const donationLink = donationId
            ? `<a href="/donor/donations/${donationId}/" class="text-decoration-none text-dark fw-semibold">${donationTitle}</a>`
            : donationTitle;

        return `
            <tr>
                <td><strong>${receiverName}</strong></td>
                <td>${donationLink}</td>
                <td>${quantity}</td>
                <td><span class="text-muted small">${message}</span></td>
                <td>${statusBadge(status)}</td>
                <td><small class="text-muted">${date}</small></td>
                <td>${actionHtml}</td>
            </tr>
        `;
    }).join("");
}

async function handleAcceptRequest(requestId) {
    if (!confirm("Are you sure you want to accept this food request?")) return;

    try {
        try {
            await apiRequest(`/api/v1/requests/${requestId}/accept/`, {
                method: "POST"
            });
        } catch (e) {
            await apiRequest(`/api/v1/requests/requests/${requestId}/accept/`, {
                method: "POST"
            });
        }
        showMessage("Food request accepted successfully!", "success", "requestMessage");
        setTimeout(() => window.location.reload(), 600);
    } catch (error) {
        console.error("Accept request error:", error);
        showMessage(error.message || "Failed to accept request.", "danger", "requestMessage");
    }
}

async function handleRejectRequest(requestId) {
    if (!confirm("Are you sure you want to reject this food request?")) return;

    try {
        try {
            await apiRequest(`/api/v1/requests/${requestId}/reject/`, {
                method: "POST"
            });
        } catch (e) {
            await apiRequest(`/api/v1/requests/requests/${requestId}/reject/`, {
                method: "POST"
            });
        }
        showMessage("Food request rejected.", "info", "requestMessage");
        setTimeout(() => window.location.reload(), 600);
    } catch (error) {
        console.error("Reject request error:", error);
        showMessage(error.message || "Failed to reject request.", "danger", "requestMessage");
    }
}

async function handleCompletePickup(requestId) {
    if (!confirm("Confirm that this food donation pickup is completed?")) return;

    try {
        let response = null;
        try {
            response = await apiRequest(`/api/v1/requests/${requestId}/complete/`, {
                method: "POST"
            });
        } catch (e) {
            response = await apiRequest(`/api/v1/requests/requests/${requestId}/complete/`, {
                method: "POST"
            });
        }
        showMessage(
            response?.message || "Donation food pickup completed successfully!",
            "success",
            "requestMessage"
        );
        setTimeout(() => window.location.reload(), 700);
    } catch (error) {
        console.error("Complete pickup error:", error);
        showMessage(error.message || "Failed to complete pickup.", "danger", "requestMessage");
    }
}

async function handleReceiverCompletePickup(requestId) {
    if (!confirm("Confirm that you have received this food donation?")) return;

    try {
        let response = null;
        try {
            response = await apiRequest(`/api/v1/requests/${requestId}/complete/`, {
                method: "POST"
            });
        } catch (e) {
            response = await apiRequest(`/api/v1/requests/requests/${requestId}/complete/`, {
                method: "POST"
            });
        }
        showMessage(
            response?.message || "Food donation marked as received successfully!",
            "success",
            "receiverRequestMessage"
        );
        setTimeout(() => window.location.reload(), 700);
    } catch (error) {
        console.error("Receiver complete pickup error:", error);
        showMessage(error.message || "Failed to complete pickup.", "danger", "receiverRequestMessage");
    }
}

function initializeDonorRequests() {
    const filter = document.getElementById("requestStatusFilter");
    if (filter) {
        filter.addEventListener("change", loadDonorRequests);
    }
    loadDonorRequests();
}

document.addEventListener("DOMContentLoaded", function () {
    if (document.getElementById("requestTableBody")) {
        initializeDonorRequests();
    }
});



/* =========================================================
   RECEIVER REQUESTS
========================================================= */

function initializeReceiverRequests() {
    const statusSelect = document.getElementById("receiverRequestStatus");
    if (statusSelect) {
        statusSelect.addEventListener("change", function () {
            const status = this.value;
            const newUrl = status
                ? window.location.pathname + "?status=" + encodeURIComponent(status)
                : window.location.pathname;
            window.location.href = newUrl;
        });
    }
}


/* =========================================================
   RECEIVER HISTORY
========================================================= */

let receiverHistoryData = [];
let receiverHistoryPage = 1;
const receiverHistoryPageSize = 5;

async function initializeReceiverHistory() {
    const filter = document.getElementById("historyFilter");
    const urlParams = new URLSearchParams(window.location.search);
    const initialStatus = urlParams.get("status");

    if (filter && initialStatus) {
        filter.value = initialStatus.toLowerCase();
    }

    if (filter) {
        filter.addEventListener("change", function () {
            const status = this.value;
            const newUrl = status
                ? window.location.pathname + "?status=" + encodeURIComponent(status)
                : window.location.pathname;
            window.location.href = newUrl;
        });
    }

    await loadReceiverHistory();
}

async function loadReceiverHistory() {
    const tableBody = document.getElementById("historyTableBody");
    if (!tableBody) return;

    try {
        let response = null;
        try {
            response = await apiRequest("/api/v1/dashboard/receiver/history/");
        } catch (e) {
            response = await apiRequest("/api/v1/requests/");
        }

        const data = response ? (response.data || response) : {};
        let list = [];

        if (Array.isArray(data.history)) {
            list = data.history;
        } else if (Array.isArray(data)) {
            list = data;
        } else if (Array.isArray(data.results)) {
            list = data.results;
        }

        receiverHistoryData = list;

        const totalReceived = data.total_received ?? list.length;
        const completed = data.completed ?? list.filter(i => (i.status || "").toUpperCase() === "COMPLETED").length;
        const cancelled = data.cancelled ?? list.filter(i => (i.status || "").toUpperCase() === "CANCELLED").length;
        const totalQty = data.total_quantity ?? 0;

        const totalEl = document.getElementById("historyTotal");
        if (totalEl) totalEl.textContent = totalReceived;

        const compEl = document.getElementById("historyCompleted");
        if (compEl) compEl.textContent = completed;

        const cancEl = document.getElementById("historyCancelled");
        if (cancEl) cancEl.textContent = cancelled;

        const qtyEl = document.getElementById("historyQuantity");
        if (qtyEl) qtyEl.textContent = totalQty;

        receiverHistoryPage = 1;
        renderReceiverHistory();

    } catch (error) {
        console.error("Receiver history error:", error);
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted py-5">
                        <i class="bi bi-inbox fs-2 d-block mb-2 text-secondary opacity-50"></i>
                        <h6 class="fw-bold text-dark mb-1">No donation history found</h6>
                        <p class="small text-muted mb-0">No history records to display.</p>
                    </td>
                </tr>
            `;
        }
    }
}

function renderReceiverHistory() {
    const tableBody = document.getElementById("historyTableBody");
    const filter = document.getElementById("historyFilter");

    if (!tableBody) return;

    const selectedStatus = filter?.value?.toUpperCase() || "";

    const filtered = receiverHistoryData.filter(item =>
        !selectedStatus ||
        (item.status || "").toUpperCase() === selectedStatus
    );

    const totalPages = Math.max(
        1,
        Math.ceil(filtered.length / receiverHistoryPageSize)
    );

    receiverHistoryPage = Math.min(receiverHistoryPage, totalPages);

    const start = (receiverHistoryPage - 1) * receiverHistoryPageSize;

    const pageItems = filtered.slice(
        start,
        start + receiverHistoryPageSize
    );

    if (filtered.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted py-5">
                    <i class="bi bi-inbox fs-2 d-block mb-2 text-secondary opacity-50"></i>
                    <h6 class="fw-bold text-dark mb-1">No history records found</h6>
                    <p class="small text-muted mb-0">No records matching the selected filter.</p>
                </td>
            </tr>
        `;
        const info = document.getElementById("historyPaginationInfo");
        if (info) info.textContent = "Showing 0 records";
        const pagination = document.getElementById("historyPagination");
        if (pagination) pagination.innerHTML = "";
        return;
    } else {
        tableBody.innerHTML = pageItems.map(item => {
            const title = historyEscape(item.donation_title);
            const donor = historyEscape(item.donor_name);
            const quantity = historyEscape(
                `${item.requested_quantity ?? 0} ${item.quantity_unit ?? ""}`
            );

            const status = (item.status || "PENDING").toUpperCase();

            const badgeClasses = {
                COMPLETED: "bg-success",
                CANCELLED: "bg-secondary",
                REJECTED: "bg-danger",
                ACCEPTED: "bg-primary",
                PENDING: "bg-warning text-dark"
            };

            const badgeClass =
                badgeClasses[status] || "bg-secondary";

            return `
                <tr>
                    <td class="fw-semibold">${title}</td>
                    <td>${donor}</td>
                    <td>${quantity}</td>
                    <td>
                        <span class="badge ${badgeClass}">
                            ${historyEscape(status)}
                        </span>
                    </td>
                    <td>${historyFormatDate(item.requested_at)}</td>
                    <td>${historyFormatDate(item.completed_at)}</td>
                    <td>
                        <span class="text-muted">-</span>
                    </td>
                </tr>
            `;
        }).join("");
    }

    const info = document.getElementById("historyPaginationInfo");

    if (info) {
        info.textContent = filtered.length
            ? `Showing ${start + 1}-${Math.min(start + pageItems.length, filtered.length)} of ${filtered.length} records`
            : "Showing 0 records";
    }

    renderHistoryPagination(totalPages);
}

function renderHistoryPagination(totalPages) {
    const pagination = document.getElementById("historyPagination");

    if (!pagination) return;

    let html = "";

    html += `
        <li class="page-item ${receiverHistoryPage === 1 ? "disabled" : ""}">
            <button class="page-link"
                onclick="changeReceiverHistoryPage(${receiverHistoryPage - 1})">
                Previous
            </button>
        </li>
    `;

    for (let i = 1; i <= totalPages; i++) {
        html += `
            <li class="page-item ${i === receiverHistoryPage ? "active" : ""}">
                <button class="page-link"
                    onclick="changeReceiverHistoryPage(${i})">
                    ${i}
                </button>
            </li>
        `;
    }

    html += `
        <li class="page-item ${receiverHistoryPage === totalPages ? "disabled" : ""}">
            <button class="page-link"
                onclick="changeReceiverHistoryPage(${receiverHistoryPage + 1})">
                Next
            </button>
        </li>
    `;

    pagination.innerHTML = html;
}

function changeReceiverHistoryPage(page) {
    const filter = document.getElementById("historyFilter");

    const filtered = receiverHistoryData.filter(item =>
        !filter?.value ||
        item.status?.toUpperCase() === filter.value.toUpperCase()
    );

    const totalPages = Math.max(
        1,
        Math.ceil(filtered.length / receiverHistoryPageSize)
    );

    if (page < 1 || page > totalPages) return;

    receiverHistoryPage = page;
    renderReceiverHistory();
}

function historyEscape(value) {
    const element = document.createElement("div");
    element.textContent = value ?? "-";
    return element.innerHTML;
}

function historyFormatDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleDateString();
}
