"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const totalEl = document.getElementById("totalDonations");
    const availableEl = document.getElementById("availableDonations");
    const requestedEl = document.getElementById("requestedDonations");
    const completedEl = document.getElementById("completedDonations");
    const messageEl = document.getElementById("dashboardMessage");
    const recentDonationsEl = document.getElementById("recentDonations");

    // This script supports the donor dashboard only.
    if (
        !totalEl ||
        !availableEl ||
        !requestedEl ||
        !completedEl ||
        !recentDonationsEl
    ) {
        return;
    }

    const token =
        localStorage.getItem("access_token") ||
        localStorage.getItem("access") ||
        sessionStorage.getItem("access_token");

    function showMessage(message, type = "danger") {
        if (!messageEl) {
            console.error(message);
            return;
        }

        messageEl.textContent = message;
        messageEl.className = `alert alert-${type}`;
        messageEl.classList.remove("d-none");
    }

    function setLoadingMessage(message) {
        recentDonationsEl.replaceChildren();

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 6;
        cell.className = "text-center text-muted py-5";
        cell.textContent = message;

        row.appendChild(cell);
        recentDonationsEl.appendChild(row);
    }

    async function apiRequest(url) {
        if (!token) {
            window.location.replace("/login/");
            throw new Error("Please log in to view your dashboard.");
        }

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json"
            }
        });

        const contentType = response.headers.get("content-type") || "";
        const result = contentType.includes("application/json")
            ? await response.json()
            : {};

        if (response.status === 401) {
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
            localStorage.removeItem("access");
            localStorage.removeItem("refresh");
            sessionStorage.removeItem("access_token");

            window.location.replace("/login/");
            throw new Error("Your session expired. Please log in again.");
        }

        if (!response.ok || result.success === false) {
            throw new Error(
                result.message || `Request failed (${response.status}).`
            );
        }

        return result;
    }

    async function loadDonorStatistics() {
        try {
            const result = await apiRequest(
                "/api/v1/dashboard/donor/"
            );

            const data = result.data || result;

            totalEl.textContent = data.total_donations ?? 0;
            availableEl.textContent = data.active_donations ?? 0;
            requestedEl.textContent = data.requested_donations ?? 0;
            completedEl.textContent = data.completed_donations ?? 0;

            console.log("Donor statistics loaded:", data);
        } catch (error) {
            console.error("Donor statistics error:", error);
            showMessage(error.message);
        }
    }
    function renderDonations(donations) {
        recentDonationsEl.replaceChildren();

        if (!Array.isArray(donations) || donations.length === 0) {
            setLoadingMessage("No donations found.");
            return;
        }

        donations.slice(0, 5).forEach(donation => {
            const row = document.createElement("tr");

            const values = [
                donation.title || "Untitled",
                donation.food_type || "—",
                `${donation.quantity ?? "—"} ${donation.quantity_unit || ""}`.trim(),
                donation.status || "—",
                donation.created_at
                    ? new Date(donation.created_at).toLocaleDateString()
                    : "—"
            ];

            values.forEach((value, index) => {
                const cell = document.createElement("td");
                cell.textContent = value;

                if (index === 3) {
                    cell.classList.add("text-nowrap");
                }

                row.appendChild(cell);
            });

            // Create the View button for this specific donation.
            const actionCell = document.createElement("td");
            const link = document.createElement("a");

            link.href = `/donor/donations/${encodeURIComponent(donation.id)}/`;
            link.textContent = "View";
            link.className = "btn btn-sm btn-outline-success";

            actionCell.appendChild(link);
            row.appendChild(actionCell);

            recentDonationsEl.appendChild(row);
        });
    }
    async function loadRecentDonations() {
        setLoadingMessage("Loading donations...");

        try {
            // This endpoint must be registered in your DRF router.
            const result = await apiRequest("/api/v1/donations/my/");

            // Supports common DRF response formats.
            const donations = Array.isArray(result)
                ? result
                : Array.isArray(result.results)
                    ? result.results
                    : Array.isArray(result.data)
                        ? result.data
                        : Array.isArray(result.data?.results)
                            ? result.data.results
                            : null;

            if (!donations) {
                throw new Error(
                    "The donations API returned an unexpected response format."
                );
            }

            renderDonations(donations);
            console.log("Recent donations loaded:", donations);
        } catch (error) {
            console.error("Recent donations error:", error);
            setLoadingMessage("Unable to load donations. Check the error in Console.");
            showMessage(error.message);
        }
    }

    loadDonorStatistics();
    loadRecentDonations();
});