console.log('Dashboard JS loaded');


/* =========================================================
   DASHBOARD MANAGEMENT
   dashboard.js
   ========================================================= */

"use strict";

// Convert special HTML characters into safe text
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (char) {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[char];
    });
}


/* =========================================================
   DONOR DASHBOARD
   ========================================================= */

async function loadDonorDashboard() {

    try {

        const response =
            await apiRequest(
                "/api/v1/dashboard/donor/"
            );

        const data = response.data || response;

        if (data.donor_name) {
            setText("donorName", data.donor_name);
        } else if (typeof TokenManager !== "undefined" && TokenManager.getUserName()) {
            setText("donorName", TokenManager.getUserName());
        }

        const total = data.total_donations ?? 0;
        const available = data.available_donations ?? data.active_donations ?? 0;
        const requested = data.pending_requests ?? data.requested_donations ?? 0;
        const completed = data.completed_donations ?? 0;

        // Support both ID conventions (dashboard.html has totalDonations, older had donorTotalDonations)
        setText("totalDonations", total);
        setText("donorTotalDonations", total);

        setText("availableDonations", available);
        setText("donorAvailableDonations", available);

        setText("requestedDonations", requested);
        setText("donorPendingRequests", requested);

        setText("completedDonations", completed);
        setText("donorCompletedDonations", completed);

        renderRecentDonations(
            data.recent_donations || []
        );

    } catch (error) {

        console.error(
            "Donor dashboard error:",
            error
        );

        const container = document.getElementById("recentDonations");
        if (container) {
            container.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted py-5">
                        <i class="bi bi-exclamation-triangle text-warning fs-3 d-block mb-2"></i>
                        <span class="text-danger fw-medium">Unable to load recent donations right now.</span>
                        <div class="mt-2">
                            <button class="btn btn-sm btn-outline-success" onclick="loadDonorDashboard()">
                                <i class="bi bi-arrow-clockwise me-1"></i> Retry
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }
    }
}


async function loadReceiverDashboard() {
    try {
        let response = null;

        try {
            response = await apiRequest("/api/v1/dashboard/receiver/");
        } catch (err) {
            response = await apiRequest("/dashboard/receiver/");
        }

        const data = response?.data || response || {};

        // Receiver name
        if (data.receiver_name) {
            setText("receiverName", data.receiver_name);
        } else if (
            typeof TokenManager !== "undefined" &&
            TokenManager.getUserName()
        ) {
            setText("receiverName", TokenManager.getUserName());
        }

        // Available donations list
        const foodList = Array.isArray(data.available_food)
            ? data.available_food
            : Array.isArray(data.available_donations)
                ? data.available_donations
                : null;

        // Available donations count
        const availableCount =
            typeof data.available_donations_count === "number"
                ? data.available_donations_count
                : typeof data.available_food_count === "number"
                    ? data.available_food_count
                    : foodList !== null
                        ? foodList.length
                        : null;

        // Only update if we have a valid count.
        // Otherwise, preserve the count rendered by Django.
        if (availableCount !== null) {
            setText("availableDonations", availableCount);
            setText("receiverAvailableFood", availableCount);
            setText("availableDonationsCount", availableCount);
        }

        // My requests
        const total =
            data.total_requests_count ??
            data.total_requests ??
            data.my_requests ??
            0;

        setText("totalRequests", total);
        setText("receiverTotalRequests", total);
        setText("totalRequestsCount", total);

        // Pending requests
        const pending =
            data.pending_requests_count ??
            data.pending_requests ??
            0;

        setText("pendingRequests", pending);
        setText("receiverPendingRequests", pending);
        setText("pendingRequestsCount", pending);

        // Completed requests
        const completed =
            data.completed_requests_count ??
            data.completed_requests ??
            0;

        setText("completedRequests", completed);
        setText("receiverCompletedRequests", completed);
        setText("completedRequestsCount", completed);

        // Render donation cards only if API provides the list
        if (foodList !== null) {
            renderAvailableDonations(foodList);
        }

    } catch (error) {
        console.error("Receiver dashboard error:", error);
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

function setText(
    elementId,
    value
) {

    const element =
        document.getElementById(
            elementId
        );


    if (element) {

        element.textContent =
            value;
    }
}


/* =========================================================
   RECENT DONATIONS
   ========================================================= */

function renderRecentDonations(
    donations
) {

    const container =
        document.getElementById(
            "recentDonations"
        );


    if (!container) {
        return;
    }


    if (!donations || !donations.length) {

        container.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted py-5">
                    <i class="bi bi-inbox fs-2 text-muted d-block mb-2"></i>
                    No donations created yet.
                    <div class="mt-2">
                        <a href="/donor/donations/create/" class="btn btn-sm btn-success">
                            <i class="bi bi-plus-lg me-1"></i> Create Donation
                        </a>
                    </div>
                </td>
            </tr>
        `;

        return;
    }


    container.innerHTML =
        donations.map(
            donation => {
                const foodName = escapeHTML(
                    donation.title ||
                    donation.food_name ||
                    "-"
                );
                const category = escapeHTML(
                    donation.food_type ||
                    donation.category ||
                    "-"
                );
                const qty = `${donation.quantity || 0} ${escapeHTML(donation.quantity_unit || donation.unit || "")}`;
                const status = donation.status || "AVAILABLE";
                const date = formatDate(donation.created_at);
                const detailUrl = `/donor/donations/${donation.id}/`;

                return `
                <tr>
                    <td class="fw-semibold">
                        <a href="${detailUrl}" class="text-decoration-none text-dark">
                            ${foodName}
                        </a>
                    </td>
                    <td>
                        <span class="badge bg-light text-dark border">
                            ${category}
                        </span>
                    </td>
                    <td>${qty}</td>
                    <td>${statusBadge(status)}</td>
                    <td class="text-muted small">${date}</td>
                    <td class="text-end">
                        <a href="${detailUrl}" class="btn btn-sm btn-outline-success">
                            View
                        </a>
                    </td>
                </tr>
                `;
            }
        ).join("");
}


/* =========================================================
   AVAILABLE DONATIONS
   ========================================================= */

function renderAvailableDonations(
    donations
) {

    const container =
        document.getElementById("availableFoodContainer") ||
        document.getElementById("availableFoodList");


    if (!container) {
        return;
    }


    if (!Array.isArray(donations) || !donations.length) {

        container.innerHTML = `
            <div class="col-12 text-center text-muted py-5">
                <i class="bi bi-inbox fs-1 d-block mb-3 text-secondary opacity-50"></i>
                <h6 class="fw-bold text-dark">No food donations currently available</h6>
                <p class="small text-muted mb-0">Check back later or explore other categories.</p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        donations.map(
            donation => {
                const title = escapeHTML(
                    donation.title ||
                    donation.food_name ||
                    "Food Donation"
                );
                const category = escapeHTML(
                    donation.food_type ||
                    donation.category ||
                    "Food"
                );
                const description = escapeHTML(
                    donation.description ||
                    "Surplus food donation available for pickup."
                );
                const qty = `${donation.quantity || 0} ${escapeHTML(donation.quantity_unit || donation.unit || "")}`;
                const location = escapeHTML(
                    donation.city
                        ? `${donation.city}${donation.pincode ? ", " + donation.pincode : ""}`
                        : (donation.pickup_address || "Nearby")
                );
                const expiryDate = donation.expiry_at
                    ? formatDate(donation.expiry_at)
                    : "Soon";
                const detailUrl = `/receiver/donations/${donation.id}/`;
                const imageHtml = donation.image
                    ? `<img src="${escapeHTML(donation.image)}" class="card-img-top" style="height:180px; object-fit:cover;" alt="${title}">`
                    : `<div class="bg-light d-flex align-items-center justify-content-center text-muted" style="height:180px;">
                            <i class="bi bi-card-image fs-1 text-secondary opacity-50"></i>
                       </div>`;

                return `
                <div class="col-md-6 col-xl-4">
                    <div class="card h-100 border shadow-sm food-card">
                        ${imageHtml}
                        <div class="card-body d-flex flex-column">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <h5 class="card-title fw-bold mb-0 text-truncate" title="${title}">
                                    ${title}
                                </h5>
                                <span class="badge bg-success-subtle text-success border border-success-subtle badge-category text-uppercase">
                                    ${category}
                                </span>
                            </div>
                            <p class="card-text text-muted small mb-3" style="min-height: 2.2rem;">
                                ${description.length > 80 ? description.substring(0, 80) + "..." : description}
                            </p>
                            <div class="mb-3 small">
                                <div class="text-dark mb-1">
                                    <i class="bi bi-box-seam text-success me-1"></i>
                                    Quantity: <strong>${qty}</strong>
                                </div>
                                <div class="text-muted mb-1">
                                    <i class="bi bi-geo-alt text-danger me-1"></i>
                                    ${location}
                                </div>
                                <div class="text-muted">
                                    <i class="bi bi-clock text-warning me-1"></i>
                                    Expires: <strong>${expiryDate}</strong>
                                </div>
                            </div>
                            <div class="mt-auto">
                                <a href="${detailUrl}" class="btn btn-success w-100 fw-semibold">
                                    <i class="bi bi-bag-plus me-1"></i> Request Food
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
                `;
            }
        ).join("");
}


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

                        ${
                            request.status === "pending"

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

document.addEventListener(
    "DOMContentLoaded",
    function () {

        /*
         * Donor dashboard
         */

        if (
            document.getElementById(
                "donorTotalDonations"
            )
        ) {

            loadDonorDashboard();
        }


        /*
         * Receiver dashboard
         */

        if (
            document.getElementById(
                "receiverAvailableFood"
            )
        ) {

            loadReceiverDashboard();
        }

    }
);