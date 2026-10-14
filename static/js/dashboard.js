console.log('Dashboard JS loaded');

// =========================================================
// FOODSHARE API REQUEST HELPER
// =========================================================

async function apiRequest(endpoint, options = {}) {
    const token =
        localStorage.getItem("access_token") ||
        sessionStorage.getItem("access_token");

    const apiUrl = endpoint.startsWith("/api/v1/")
        ? endpoint
        : `/api/v1${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

    const headers = {
        Accept: "application/json",
        ...options.headers
    };

    if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(apiUrl, {
        ...options,
        headers
    });

    let data = {};

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {
        throw new Error(
            data.detail ||
            data.message ||
            `API request failed (${response.status})`
        );
    }

    return data;
}


// function escapeHTML(value) {
//     return String(value ?? "").replace(/[&<>"']/g, function (char) {
//         const entities = {
//             "&": "&amp;",
//             "<": "&lt;",
//             ">": "&gt;",
//             '"': "&quot;",
//             "'": "&#39;"
//         };

//         return entities[char];
//     });
// }

/* =========================================================
   DASHBOARD MANAGEMENT
   dashboard.js
   ========================================================= */

"use strict";


// function escapeHTML(value) {
//     return String(value ?? "").replace(/[&<>"']/g, function (char) {
//         const entities = {
//             "&": "&amp;",
//             "<": "&lt;",
//             ">": "&gt;",
//             '"': "&quot;",
//             "'": "&#39;"
//         };

//         return entities[char];
//     });
// }


/* =========================================================
   DONOR DASHBOARD
   ========================================================= */

// =========================================================
// DONOR DASHBOARD
// =========================================================

async function loadDonorDashboard() {
    const tableBody = document.getElementById("recentDonations");

    if (!tableBody) {
        console.error("Donor dashboard: #recentDonations was not found.");
        return;
    }

    // Show loading state while fetching donations.
    tableBody.innerHTML = `
        <tr>
            <td colspan="6" class="text-center py-4">
                Loading donations...
            </td>
        </tr>
    `;

    try {
        // Fetch donations from the existing API.
        const response = await apiRequest("/donations/");

        console.log("Donor dashboard API response:", response);

        // Support common Django REST Framework response formats.
        let allDonations = [];

        if (Array.isArray(response)) {
            allDonations = response;
        } else if (Array.isArray(response.results)) {
            allDonations = response.results;
        } else if (Array.isArray(response.donations)) {
            allDonations = response.donations;
        } else if (Array.isArray(response.data)) {
            allDonations = response.data;
        }

        // Read the logged-in user's information.
        let user = {};

        try {
            user = JSON.parse(
                localStorage.getItem("user") ||
                sessionStorage.getItem("user") ||
                "{}"
            );
        } catch (error) {
            console.error("Unable to read logged-in user:", error);
        }

        const userId = user.id == null
            ? ""
            : String(user.id);

        // Match donations to the logged-in donor.
        // The API may return donor as an ID or a nested object.
        const myDonations = allDonations.filter(donation => {
            const donor = donation.donor;

            const donorId =
                donation.donor_id ??
                (donor && typeof donor === "object"
                    ? donor.id
                    : donor);

            // If the API provides no donor ID, do not silently
            // discard the donation. The backend may already
            // return only the current donor's donations.
            if (donorId == null || donorId === "") {
                return true;
            }

            return String(donorId) === userId;
        });

        // Calculate dashboard statistics from the matched donations.
        const total = myDonations.length;

        const available = myDonations.filter(donation =>
            String(donation.status || "").toUpperCase() === "AVAILABLE"
        ).length;

        const requested = myDonations.filter(donation =>
            ["REQUESTED", "PENDING", "APPROVED"].includes(
                String(donation.status || "").toUpperCase()
            )
        ).length;

        const completed = myDonations.filter(donation =>
            String(donation.status || "").toUpperCase() === "COMPLETED"
        ).length;

        // Update dashboard counters.
        setText("donorTotalDonations", total);
        setText("donorAvailableDonations", available);
        setText("donorRequestedDonations", requested);
        setText("donorCompletedDonations", completed);

        // Sort newest first and show the five most recent.
        const recentDonations = [...myDonations]
            .sort((a, b) =>
                new Date(b.created_at || 0) -
                new Date(a.created_at || 0)
            )
            .slice(0, 5);

        renderRecentDonations(recentDonations);

    } catch (error) {
        console.error("Donor dashboard loading error:", error);

        tableBody.innerHTML = `
            <tr>
                <td colspan="6"
                    class="text-center text-danger py-4">
                    Unable to load donations.
                    Please refresh the page and try again.
                </td>
            </tr>
        `;
    }
}

function formatDate(dateValue) {
    if (!dateValue) {
        return "N/A";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "N/A";
    }

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}



/* =========================================================
   RECEIVER DASHBOARD
   ========================================================= */




async function loadReceiverDashboard() {
    // Load receiver statistics.
    try {
        const data = await apiRequest("/dashboard/receiver/");

        setText("receiverTotalRequests", data.total_requests ?? 0);
        setText("receiverPendingRequests", data.pending_requests ?? 0);
        setText("receiverCompletedRequests", data.completed_requests ?? 0);
    } catch (error) {
        console.error("Receiver statistics error:", error);
    }

    // Load available food donations.
    const container = document.getElementById("availableFoodContainer");

    if (!container) {
        console.error("availableFoodContainer was not found.");
        return;
    }

    try {
        // Load donations without the status query parameter.
        const response = await apiRequest("/donations/");

        console.log("Donations API response:", response);

        const allDonations = Array.isArray(response)
            ? response
            : response.results || response.donations || [];

        // Display only donations that are available.
        const donations = allDonations.filter(
            donation =>
                String(donation.status || "").toUpperCase() === "AVAILABLE"
        );

        setText("receiverAvailableFood", donations.length);
        renderAvailableDonations(donations);

    } catch (error) {
        console.error("Available donations error:", error);

        container.innerHTML = `
            <div class="col-12">
                <div class="alert alert-danger">
                    Could not load available food.
                    Please check the browser console for the API error.
                </div>
            </div>
        `;
    }
}


/* =========================================================
   ADMIN DASHBOARD
   ========================================================= */

async function loadAdminDashboard() {

    try {

        const data =
            await apiRequest(
                "/dashboard/admin/"
            );


        setText(
            "adminTotalUsers",
            data.total_users ?? 0
        );


        setText(
            "adminTotalDonations",
            data.total_donations ?? 0
        );


        setText(
            "adminTotalRequests",
            data.total_requests ?? 0
        );


        setText(
            "adminCompletedRequests",
            data.completed_requests ?? 0
        );


        createDonationActivityChart(
            data.donation_activity || []
        );


        createUserDistributionChart(
            data.user_distribution || {}
        );

    } catch (error) {

        console.error(
            "Admin dashboard error:",
            error
        );
    }
}


/* =========================================================
   SET TEXT HELPER
   ========================================================= */


/* =========================================================
   SET TEXT HELPER — DONOR, RECEIVER AND ADMIN
   ========================================================= */

function setText(elementId, value) {
    const idAliases = {
        totalDonations: [
            "totalDonations",
            "donorTotalDonations"
        ],
        donorTotalDonations: [
            "totalDonations",
            "donorTotalDonations"
        ],

        availableDonations: [
            "availableDonations",
            "donorAvailableDonations"
        ],
        donorAvailableDonations: [
            "availableDonations",
            "donorAvailableDonations"
        ],

        requestedDonations: [
            "requestedDonations",
            "donorRequestedDonations"
        ],
        donorRequestedDonations: [
            "requestedDonations",
            "donorRequestedDonations"
        ],

        completedDonations: [
            "completedDonations",
            "donorCompletedDonations"
        ],
        donorCompletedDonations: [
            "completedDonations",
            "donorCompletedDonations"
        ]
    };

    const ids = idAliases[elementId] || [elementId];

    ids.forEach(id => {
        const element = document.getElementById(id);

        if (element) {
            element.textContent = String(value ?? 0);
        }
    });
}



/* =========================================================
   RECENT DONATIONS
   ========================================================= */

function renderRecentDonations(donations) {
    const container = document.getElementById("recentDonations");

    if (!container) {
        console.error("Dashboard element #recentDonations was not found.");
        return;
    }

    if (!Array.isArray(donations) || donations.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted py-4">
                    No recent donations found.
                </td>
            </tr>
        `;
        return;
    }

    container.innerHTML = donations.map(donation => `
        <tr>
            <td>${escapeHTML(donation.title || donation.food_name || "-")}</td>
            <td>${escapeHTML(donation.food_type || donation.category || "-")}</td>
            <td>${escapeHTML(String(donation.quantity ?? "-"))}</td>
            <td>${statusBadge(donation.status)}</td>
            <td>${escapeHTML(formatDate(donation.created_at))}</td>
            <td>
                <a href="/donor/donations/${encodeURIComponent(donation.id)}/"
                   class="btn btn-sm btn-outline-success">
                    View
                </a>
            </td>
        </tr>
    `).join("");
}



function escapeHTML(value) {
    const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    };

    return String(value ?? "").replace(/[&<>"']/g, function (char) {
        return entities[char];
    });
}

function statusBadge(status) {
    const normalizedStatus = String(status || "UNKNOWN").toUpperCase();

    const statusClasses = {
        AVAILABLE: "bg-success",
        PENDING: "bg-warning text-dark",
        REQUESTED: "bg-warning text-dark",
        APPROVED: "bg-primary",
        COMPLETED: "bg-secondary",
        REJECTED: "bg-danger",
        CANCELLED: "bg-dark",
        EXPIRED: "bg-secondary"
    };

    const badgeClass = statusClasses[normalizedStatus] || "bg-secondary";

    return `
        <span class="badge ${badgeClass}">
            ${escapeHTML(normalizedStatus)}
        </span>
    `;
}
/* =========================================================
   AVAILABLE DONATIONS
   ========================================================= */


function renderAvailableDonations(donations) {
    const container = document.getElementById("availableFoodContainer");

    if (!container) {
        return;
    }

    if (!donations || donations.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center text-muted py-4">
                No food donations currently available.
            </div>
        `;
        return;
    }

    container.innerHTML = donations.map(donation => {
        const title = donation.title || donation.food_name || "-";
        const category = donation.food_type || donation.category || "-";
        const quantity = donation.quantity ?? "-";

        const imageHtml = donation.image
            ? `
                <img
                    src="${escapeHTML(donation.image)}"
                    class="card-img-top"
                    style="height: 180px; object-fit: cover;"
                    alt="Food donation"
                >
            `
            : "";

        return `
            <div class="col-md-6 col-xl-4 mb-4">
                <div class="card h-100 border-0 shadow-sm">
                    ${imageHtml}

                    <div class="card-body">
                        <h5 class="card-title">
                            ${escapeHTML(title)}
                        </h5>

                        <p class="text-muted mb-2">
                            Category: ${escapeHTML(category)}
                        </p>

                        <p class="mb-2">
                            Quantity:
                            <strong>${escapeHTML(String(quantity))}</strong>
                            ${escapeHTML(donation.quantity_unit || "")}
                        </p>

                        <p class="mb-3">
                            <i class="bi bi-calendar-event me-1"></i>
                            <strong>Expires:</strong>
                            ${escapeHTML(
            donation.expiry_at
                ? formatDate(donation.expiry_at)
                : donation.expiry_date
                    ? formatDate(donation.expiry_date)
                    : "Not specified"
        )}
                        </p>

                        <a
                            href="/receiver/donations/${encodeURIComponent(donation.id)}/"
                            class="btn btn-success w-100">
                            <i class="bi bi-eye me-1"></i>
                            View Donation
                        </a>
                    </div>
                </div>
            </div>
        `;
    }).join("");
}



// function escapeHTML(value) {
//     return String(value ?? "").replace(/[&<>"']/g, function (char) {
//         const entities = {
//             "&": "&amp;",
//             "<": "&lt;",
//             ">": "&gt;",
//             '"': "&quot;",
//             "'": "&#39;"
//         };

//         return entities[char];
//     });
// }


/* =========================================================
   ADMIN DONATION ACTIVITY CHART
   ========================================================= */

function createDonationActivityChart(
    activity
) {

    const canvas =
        document.getElementById(
            "donationActivityChart"
        );


    if (!canvas ||
        typeof Chart === "undefined") {

        return;
    }


    const labels =
        activity.map(
            item =>
                item.date ||
                item.label
        );


    const values =
        activity.map(
            item =>
                item.count || 0
        );


    new Chart(
        canvas,
        {
            type: "line",

            data: {

                labels: labels,

                datasets: [
                    {
                        label:
                            "Donations",

                        data:
                            values,

                        tension:
                            0.3,

                        fill:
                            false
                    }
                ]
            },

            options: {

                responsive: true,

                maintainAspectRatio:
                    false,

                plugins: {

                    legend: {
                        display: true
                    }

                }
            }
        }
    );
}


/* =========================================================
   USER DISTRIBUTION CHART
   ========================================================= */

function createUserDistributionChart(
    distribution
) {

    const canvas =
        document.getElementById(
            "userDistributionChart"
        );


    if (!canvas ||
        typeof Chart === "undefined") {

        return;
    }


    new Chart(
        canvas,
        {
            type: "doughnut",

            data: {

                labels: [
                    "Donors",
                    "Receivers",
                    "Admins"
                ],

                datasets: [
                    {
                        data: [

                            distribution.donors || 0,

                            distribution.receivers || 0,

                            distribution.admins || 0

                        ]
                    }
                ]
            },

            options: {

                responsive: true,

                plugins: {

                    legend: {
                        position: "bottom"
                    }

                }
            }
        }
    );
}


/* =========================================================
   ADMIN REPORTS
   ========================================================= */

async function initializeAdminReports() {

    const button =
        document.getElementById(
            "generateReportBtn"
        );


    if (button) {

        button.addEventListener(
            "click",
            loadAdminReports
        );
    }


    const exportButton =
        document.getElementById(
            "exportReportBtn"
        );


    if (exportButton) {

        exportButton.addEventListener(
            "click",
            exportReport
        );
    }


    await loadAdminReports();
}


/* =========================================================
   LOAD REPORTS
   ========================================================= */

async function loadAdminReports() {

    try {

        const startDate =
            document.getElementById(
                "reportStartDate"
            )?.value || "";


        const endDate =
            document.getElementById(
                "reportEndDate"
            )?.value || "";


        const params =
            new URLSearchParams();


        if (startDate) {

            params.set(
                "start_date",
                startDate
            );
        }


        if (endDate) {

            params.set(
                "end_date",
                endDate
            );
        }


        const data =
            await apiRequest(
                `/dashboard/reports/?${params.toString()}`
            );


        setText(
            "reportDonations",
            data.total_donations ?? 0
        );


        setText(
            "reportDistributed",
            data.food_distributed ?? 0
        );


        setText(
            "reportCompleted",
            data.completed_requests ?? 0
        );


        setText(
            "reportSuccessRate",
            `${data.success_rate ?? 0}%`
        );


        setText(
            "summaryDonations",
            data.total_donations ?? 0
        );


        setText(
            "summaryApproved",
            data.approved_requests ?? 0
        );


        setText(
            "summaryCompleted",
            data.completed_requests ?? 0
        );


        setText(
            "summaryRejected",
            data.rejected_requests ?? 0
        );


        setText(
            "summaryApprovedPercent",
            `${data.approved_percentage ?? 0}%`
        );


        setText(
            "summaryCompletedPercent",
            `${data.completed_percentage ?? 0}%`
        );


        setText(
            "summaryRejectedPercent",
            `${data.rejected_percentage ?? 0}%`
        );


        createReportCharts(
            data
        );

    } catch (error) {

        showMessage(
            error.message ||
            "Unable to load reports.",
            "danger",
            "adminReportsMessage"
        );
    }
}


/* =========================================================
   REPORT CHARTS
   ========================================================= */

function createReportCharts(
    data
) {

    if (
        typeof Chart === "undefined"
    ) {
        return;
    }


    const timelineCanvas =
        document.getElementById(
            "donationsOverTimeChart"
        );


    if (timelineCanvas) {

        new Chart(
            timelineCanvas,
            {
                type: "line",

                data: {

                    labels:
                        data.timeline_labels ||
                        [],

                    datasets: [
                        {
                            label:
                                "Donations",

                            data:
                                data.timeline_values ||
                                [],

                            tension:
                                0.3
                        }
                    ]
                },

                options: {
                    responsive: true
                }
            }
        );
    }


    const categoryCanvas =
        document.getElementById(
            "donationCategoryChart"
        );


    if (categoryCanvas) {

        new Chart(
            categoryCanvas,
            {
                type: "doughnut",

                data: {

                    labels:
                        data.category_labels ||
                        [],

                    datasets: [
                        {
                            data:
                                data.category_values ||
                                []
                        }
                    ]
                },

                options: {
                    responsive: true,

                    plugins: {
                        legend: {
                            position: "bottom"
                        }
                    }
                }
            }
        );
    }
}


/* =========================================================
   EXPORT REPORT
   ========================================================= */

async function exportReport() {

    try {

        const startDate =
            document.getElementById(
                "reportStartDate"
            )?.value || "";


        const endDate =
            document.getElementById(
                "reportEndDate"
            )?.value || "";


        const params =
            new URLSearchParams();


        if (startDate) {

            params.set(
                "start_date",
                startDate
            );
        }


        if (endDate) {

            params.set(
                "end_date",
                endDate
            );
        }


        const token =
            getAccessToken();


        const response =
            await fetch(
                `/api/v1/dashboard/reports/export/?${params.toString()}`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );


        if (!response.ok) {

            throw new Error(
                "Unable to export report."
            );
        }


        const blob =
            await response.blob();


        const url =
            window.URL.createObjectURL(
                blob
            );


        const link =
            document.createElement(
                "a"
            );


        link.href = url;

        link.download =
            "food_waste_report.csv";


        document.body.appendChild(
            link
        );


        link.click();


        link.remove();


        window.URL.revokeObjectURL(
            url
        );

    } catch (error) {

        showMessage(
            error.message,
            "danger"
        );
    }
}


/* =========================================================
   ADMIN USERS
   ========================================================= */

async function initializeAdminUsers() {

    const search =
        document.getElementById(
            "userSearch"
        );


    const role =
        document.getElementById(
            "userRoleFilter"
        );


    const status =
        document.getElementById(
            "userStatusFilter"
        );


    if (search) {

        search.addEventListener(
            "input",
            debounce(
                loadAdminUsers,
                400
            )
        );
    }


    if (role) {

        role.addEventListener(
            "change",
            loadAdminUsers
        );
    }


    if (status) {

        status.addEventListener(
            "change",
            loadAdminUsers
        );
    }


    await loadAdminUsers();
}


/* =========================================================
   LOAD USERS
   ========================================================= */

async function loadAdminUsers() {

    const table =
        document.getElementById(
            "adminUsersTable"
        );


    if (!table) {
        return;
    }


    try {

        const params =
            new URLSearchParams();


        const search =
            document.getElementById(
                "userSearch"
            )?.value;


        const role =
            document.getElementById(
                "userRoleFilter"
            )?.value;


        const status =
            document.getElementById(
                "userStatusFilter"
            )?.value;


        if (search) {
            params.set(
                "search",
                search
            );
        }


        if (role) {
            params.set(
                "role",
                role
            );
        }


        if (status) {
            params.set(
                "status",
                status
            );
        }


        const data =
            await apiRequest(
                `/auth/users/?${params.toString()}`
            );


        const users =
            Array.isArray(data)
                ? data
                : data.results || [];


        if (!users.length) {

            table.innerHTML = `
                <tr>
                    <td colspan="7"
                        class="text-center
                               text-muted py-5">

                        No users found.

                    </td>
                </tr>
            `;

            return;
        }


        table.innerHTML =
            users.map(
                user => `

                <tr>

                    <td>
                        <strong>
                            ${escapeHTML(
                    user.username ||
                    user.name ||
                    "-"
                )}
                        </strong>
                    </td>

                    <td>
                        ${escapeHTML(
                    user.email ||
                    "-"
                )}
                    </td>

                    <td>
                        ${escapeHTML(
                    user.phone ||
                    user.phone_no ||
                    "-"
                )}
                    </td>

                    <td>
                        ${escapeHTML(
                    user.role ||
                    "-"
                )}
                    </td>

                    <td>
                        ${statusBadge(
                    user.is_active
                        ? "active"
                        : "inactive"
                )}
                    </td>

                    <td>
                        ${formatDate(
                    user.date_joined ||
                    user.created_at
                )}
                    </td>

                    <td>

                        <button
                            class="btn btn-sm btn-outline-primary"
                            onclick="viewUser(${user.id})">

                            View

                        </button>

                    </td>

                </tr>
            `
            ).join("");

    } catch (error) {

        table.innerHTML = `
            <tr>
                <td colspan="7"
                    class="text-center text-danger">

                    Unable to load users.

                </td>
            </tr>
        `;
    }
}


/* =========================================================
   VIEW USER
   ========================================================= */

async function viewUser(
    userId
) {

    try {

        const user =
            await apiRequest(
                `/auth/users/${userId}/`
            );


        const body =
            document.getElementById(
                "userDetailsBody"
            );


        if (!body) {
            return;
        }


        body.innerHTML = `

            <div class="mb-3">

                <strong>Name</strong>

                <p>
                    ${escapeHTML(
            user.username ||
            user.name ||
            "-"
        )}
                </p>

            </div>


            <div class="mb-3">

                <strong>Email</strong>

                <p>
                    ${escapeHTML(
            user.email ||
            "-"
        )}
                </p>

            </div>


            <div class="mb-3">

                <strong>Role</strong>

                <p>
                    ${escapeHTML(
            user.role ||
            "-"
        )}
                </p>

            </div>


            <div>

                <strong>Status</strong>

                <p>
                    ${statusBadge(
            user.is_active
                ? "active"
                : "inactive"
        )}
                </p>

            </div>
        `;


        if (
            typeof bootstrap !==
            "undefined"
        ) {

            const modal =
                new bootstrap.Modal(
                    document.getElementById(
                        "userDetailsModal"
                    )
                );

            modal.show();
        }

    } catch (error) {

        showMessage(
            error.message,
            "danger"
        );
    }
}


/* =========================================================
   ADMIN DONATIONS
   ========================================================= */

async function initializeAdminDonations() {

    const search =
        document.getElementById(
            "adminDonationSearch"
        );


    const category =
        document.getElementById(
            "adminDonationCategory"
        );


    const status =
        document.getElementById(
            "adminDonationStatus"
        );


    const date =
        document.getElementById(
            "adminDonationDate"
        );


    if (search) {

        search.addEventListener(
            "input",
            debounce(
                loadAdminDonations,
                400
            )
        );
    }


    [category, status, date]
        .filter(Boolean)
        .forEach(
            element => {

                element.addEventListener(
                    "change",
                    loadAdminDonations
                );
            }
        );


    await loadAdminDonations();
}


/* =========================================================
   LOAD ADMIN DONATIONS
   ========================================================= */

async function loadAdminDonations() {

    const table =
        document.getElementById(
            "adminDonationsTable"
        );


    if (!table) {
        return;
    }


    try {

        const params =
            new URLSearchParams();


        const search =
            document.getElementById(
                "adminDonationSearch"
            )?.value;


        const category =
            document.getElementById(
                "adminDonationCategory"
            )?.value;


        const status =
            document.getElementById(
                "adminDonationStatus"
            )?.value;


        const date =
            document.getElementById(
                "adminDonationDate"
            )?.value;


        if (search) {
            params.set(
                "search",
                search
            );
        }


        if (category) {
            params.set(
                "category",
                category
            );
        }


        if (status) {
            params.set(
                "status",
                status
            );
        }


        if (date) {
            params.set(
                "date",
                date
            );
        }


        const data =
            await apiRequest(
                `/donations/?${params.toString()}`
            );


        const donations =
            Array.isArray(data)
                ? data
                : data.results || [];


        table.innerHTML =
            donations.length

                ?

                donations.map(
                    donation => `

                <tr>

                    <td>
                        ${escapeHTML(
                        donation.food_name ||
                        donation.title ||
                        "-"
                    )}
                    </td>

                    <td>
                        ${escapeHTML(
                        donation.donor_name ||
                        "-"
                    )}
                    </td>

                    <td>
                        ${escapeHTML(
                        donation.quantity ||
                        "-"
                    )}
                    </td>

                    <td>
                        ${escapeHTML(
                        donation.category ||
                        "-"
                    )}
                    </td>

                    <td>
                        ${formatDate(
                        donation.expiry_date
                    )}
                    </td>

                    <td>
                        ${statusBadge(
                        donation.status
                    )}
                    </td>

                    <td>
                        ${formatDate(
                        donation.created_at
                    )}
                    </td>

                    <td>
                        <a
                            href="/receiver/donations/${donation.id}/"
                            class="btn btn-sm
                                   btn-outline-primary">

                            View

                        </a>
                    </td>

                </tr>
            `
                ).join("")

                :

                `
            <tr>

                <td colspan="8"
                    class="text-center
                           text-muted py-5">

                    No donations found.

                </td>

            </tr>
            `;

    } catch (error) {

        table.innerHTML = `
            <tr>

                <td colspan="8"
                    class="text-center text-danger">

                    Unable to load donations.

                </td>

            </tr>
        `;
    }
}


/* =========================================================
   ADMIN REQUESTS
   ========================================================= */

async function initializeAdminRequests() {

    const search =
        document.getElementById(
            "adminRequestSearch"
        );


    const status =
        document.getElementById(
            "adminRequestStatus"
        );


    const date =
        document.getElementById(
            "adminRequestDate"
        );


    if (search) {

        search.addEventListener(
            "input",
            debounce(
                loadAdminRequests,
                400
            )
        );
    }


    [status, date]
        .filter(Boolean)
        .forEach(
            element => {

                element.addEventListener(
                    "change",
                    loadAdminRequests
                );
            }
        );


    await loadAdminRequests();
}


/* =========================================================
   LOAD ADMIN REQUESTS
   ========================================================= */

async function loadAdminRequests() {

    const table =
        document.getElementById(
            "adminRequestsTable"
        );


    if (!table) {
        return;
    }


    try {

        const params =
            new URLSearchParams();


        const search =
            document.getElementById(
                "adminRequestSearch"
            )?.value;


        const status =
            document.getElementById(
                "adminRequestStatus"
            )?.value;


        const date =
            document.getElementById(
                "adminRequestDate"
            )?.value;


        if (search) {
            params.set(
                "search",
                search
            );
        }


        if (status) {
            params.set(
                "status",
                status
            );
        }


        if (date) {
            params.set(
                "date",
                date
            );
        }


        const data =
            await apiRequest(
                `/requests/?${params.toString()}`
            );


        const requests =
            Array.isArray(data)
                ? data
                : data.results || [];


        table.innerHTML =
            requests.length

                ?

                requests.map(
                    request => `

                <tr>

                    <td>
                        ${escapeHTML(
                        request.receiver_name ||
                        "-"
                    )}
                    </td>

                    <td>
                        ${escapeHTML(
                        request.food_name ||
                        "-"
                    )}
                    </td>

                    <td>
                        ${escapeHTML(
                        request.quantity ||
                        "-"
                    )}
                    </td>

                    <td>
                        ${escapeHTML(
                        request.donor_name ||
                        "-"
                    )}
                    </td>

                    <td>
                        ${statusBadge(
                        request.status
                    )}
                    </td>

                    <td>
                        ${formatDateTime(
                        request.created_at
                    )}
                    </td>

                    <td>

                        ${request.status === "pending"

                            ?

                            `
                            <button
                                class="btn btn-sm btn-success"
                                onclick="approveRequest(${request.id})">

                                Approve

                            </button>

                            <button
                                class="btn btn-sm btn-danger"
                                onclick="rejectRequest(${request.id})">

                                Reject

                            </button>
                            `

                            :

                            ""
                        }

                    </td>

                </tr>
            `
                ).join("")

                :

                `
            <tr>

                <td colspan="7"
                    class="text-center
                           text-muted py-5">

                    No requests found.

                </td>

            </tr>
            `;

    } catch (error) {

        table.innerHTML = `
            <tr>

                <td colspan="7"
                    class="text-center text-danger">

                    Unable to load requests.

                </td>

            </tr>
        `;
    }
}


/* =========================================================
   DEBOUNCE
   ========================================================= */

function debounce(
    callback,
    delay
) {

    let timeout;


    return function (...args) {

        clearTimeout(
            timeout
        );


        timeout =
            setTimeout(
                () => callback.apply(
                    this,
                    args
                ),
                delay
            );
    };
}


/* =========================================================
   DOM READY
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
    console.log("Dashboard JS loaded - updated version");

    // Donor dashboard
    if (document.getElementById("recentDonations")) {
        loadDonorDashboard();
    }

    // Receiver dashboard
    if (document.getElementById("availableFoodContainer")) {
        loadReceiverDashboard();
    }

    // Admin dashboard
    if (document.getElementById("adminTotalUsers")) {
        loadAdminDashboard();
    }

    // Admin report page
    if (document.getElementById("generateReportBtn")) {
        initializeAdminReports();
    }

    // Admin users page
    if (document.getElementById("adminUsersTable")) {
        initializeAdminUsers();
    }

    // Admin donations page
    if (document.getElementById("adminDonationsTable")) {
        initializeAdminDonations();
    }

    // Admin requests page
    if (document.getElementById("adminRequestsTable")) {
        initializeAdminRequests();
    }
});