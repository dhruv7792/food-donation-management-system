
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const API_URL = "/api/v1/requests/";
    const PAGE_SIZE = 10;

    const table = document.getElementById("historyTableBody");
    if (!table) return;

    const elements = {
        message: document.getElementById("historyMessage"),
        total: document.getElementById("historyTotal"),
        completed: document.getElementById("historyCompleted"),
        cancelled: document.getElementById("historyCancelled"),
        quantity: document.getElementById("historyQuantity"),
        filter: document.getElementById("historyFilter"),
        paginationInfo: document.getElementById("historyPaginationInfo"),
        pagination: document.getElementById("historyPagination")
    };

    let allRecords = [];
    let currentPage = 1;

    function getToken() {
        return localStorage.getItem("access_token") ||
               localStorage.getItem("access") ||
               "";
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

    function getArray(result) {
        if (Array.isArray(result)) return result;
        if (Array.isArray(result.results)) return result.results;
        if (Array.isArray(result.data)) return result.data;
        return [];
    }

    function getStatus(record) {
        return String(record.status || "PENDING").toUpperCase();
    }

    function getFoodName(record) {
        const donation = record.donation;

        return record.donation_title ||
            (donation && typeof donation === "object"
                ? donation.title
                : "") ||
            `Donation #${typeof donation === "object"
                ? donation?.id ?? "?"
                : donation ?? "?"}`;
    }

    function getDonorName(record) {
        if (record.donor_name) return record.donor_name;

        if (record.donor && typeof record.donor === "object") {
            return record.donor.organization_name ||
                   record.donor.username ||
                   record.donor.email ||
                   "—";
        }

        return record.donor || "—";
    }

    function getRequestDate(record) {
        const value = record.requested_at || record.created_at;
        if (!value) return "—";

        const date = new Date(value);
        return Number.isNaN(date.getTime())
            ? String(value)
            : date.toLocaleString();
    }
function getCompletedDate(record) {
    const value = record.completed_at;

    if (!value) return "—";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? String(value)
        : date.toLocaleString();
}

    function showMessage(message, type = "danger") {
        if (!elements.message) return;

        elements.message.textContent = message;
        elements.message.className = `alert alert-${type}`;
    }

    function updateSummary(records) {
        const completed = records.filter(record =>
            getStatus(record) === "COMPLETED"
        );

        const cancelled = records.filter(record =>
            getStatus(record) === "CANCELLED"
        );

        const quantity = completed.reduce((sum, record) => {
            const value = Number(record.requested_quantity);
            return sum + (Number.isFinite(value) ? value : 0);
        }, 0);

        elements.total.textContent = records.length;
        elements.completed.textContent = completed.length;
        elements.cancelled.textContent = cancelled.length;
        elements.quantity.textContent = quantity;
    }

    function renderHistory() {
        const filter = elements.filter?.value.toUpperCase() || "";

        const filtered = allRecords.filter(record => {
            const status = getStatus(record);

            if (filter === "COMPLETED") return status === "COMPLETED";
            if (filter === "CANCELLED") return status === "CANCELLED";
            if (filter === "REJECTED") return status === "REJECTED";

            return true;
        });

        const totalPages = Math.max(
            1,
            Math.ceil(filtered.length / PAGE_SIZE)
        );

        currentPage = Math.min(currentPage, totalPages);

        const start = (currentPage - 1) * PAGE_SIZE;
        const pageRecords = filtered.slice(start, start + PAGE_SIZE);

        if (!pageRecords.length) {
            table.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-5 text-muted">
                        ${filtered.length
                            ? "No records on this page."
                            : "No history records found."}
                    </td>
                </tr>`;
        } else {
            table.innerHTML = pageRecords.map(record => {
                const status = getStatus(record);

                const badge = {
                    COMPLETED: "success",
                    CANCELLED: "secondary",
                    REJECTED: "danger",
                    ACCEPTED: "primary",
                    PENDING: "warning"
                }[status] || "secondary";

                return `
                    <tr>
                        <td>${escapeHTML(getFoodName(record))}</td>
                        <td>${escapeHTML(getDonorName(record))}</td>
                        <td>${escapeHTML(record.requested_quantity ?? "—")}</td>
                        <td>
                            <span class="badge text-bg-${badge}">
                                ${escapeHTML(status)}
                            </span>
                        </td>
                        <td>${escapeHTML(getRequestDate(record))}</td>
                        <td>${escapeHTML(getCompletedDate(record))}</td>
                        <td>—</td>
                    </tr>`;
            }).join("");
        }

        elements.paginationInfo.textContent =
            `Showing ${filtered.length ? start + 1 : 0}–` +
            `${Math.min(start + PAGE_SIZE, filtered.length)} ` +
            `of ${filtered.length} records`;

        renderPagination(totalPages);
    }

    function renderPagination(totalPages) {
        if (!elements.pagination) return;

        elements.pagination.innerHTML = "";

        if (totalPages <= 1) return;

        function addButton(label, page, disabled, active = false) {
            const li = document.createElement("li");
            li.className = `page-item${disabled ? " disabled" : ""}` +
                           `${active ? " active" : ""}`;

            const button = document.createElement("button");
            button.type = "button";
            button.className = "page-link";
            button.textContent = label;
            button.disabled = disabled;

            button.addEventListener("click", () => {
                currentPage = page;
                renderHistory();
            });

            li.appendChild(button);
            elements.pagination.appendChild(li);
        }

        addButton("Previous", currentPage - 1, currentPage === 1);

        for (let page = 1; page <= totalPages; page++) {
            addButton(
                String(page),
                page,
                false,
                page === currentPage
            );
        }

        addButton(
            "Next",
            currentPage + 1,
            currentPage === totalPages
        );
    }

    async function initializeReceiverHistory() {
        const token = getToken();

        if (!token) {
            table.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-danger py-4">
                        Please log in to view your history.
                    </td>
                </tr>`;
            showMessage("Your login session is missing. Please log in again.");
            return;
        }

        table.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    <span class="spinner-border spinner-border-sm text-success"></span>
                    Loading history...
                </td>
            </tr>`;

        try {
            const response = await fetch(API_URL, {
                method: "GET",
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${token}`
                },
                credentials: "same-origin"
            });

            const contentType =
                response.headers.get("content-type") || "";

            const result = contentType.includes("application/json")
                ? await response.json()
                : { message: await response.text() };

            if (response.status === 401) {
                localStorage.removeItem("access_token");
                localStorage.removeItem("refresh_token");
                localStorage.removeItem("user");
                window.location.replace("/login/");
                return;
            }

            if (!response.ok) {
                throw new Error(
                    result.detail ||
                    result.message ||
                    `Unable to load history (HTTP ${response.status}).`
                );
            }

            allRecords = getArray(result);

            // The API should already return the logged-in receiver's requests.
            updateSummary(allRecords);
            renderHistory();

            if (elements.message) {
                elements.message.className = "d-none";
            }
        } catch (error) {
            console.error("Receiver history loading failed:", error);

            table.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-danger py-4">
                        ${escapeHTML(error.message)}
                    </td>
                </tr>`;

            showMessage(error.message);
        }
    }

    elements.filter?.addEventListener("change", () => {
        currentPage = 1;
        renderHistory();
    });

    initializeReceiverHistory();
});