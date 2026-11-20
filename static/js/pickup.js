
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const API = "/api/v1/pickups/pickups/";

    // 1. Authentication helpers
    function getToken() {
        return localStorage.getItem("access_token");
    }

    function getUser() {
        try {
            return JSON.parse(localStorage.getItem("user") || "null");
        } catch (error) {
            console.error("Unable to read user:", error);
            return null;
        }
    }

    function getRole() {
        return String(getUser()?.role || "").toUpperCase();
    }

    // 2. Format time as 10:30 AM
    function formatPickupTime(time) {
        if (!time) return "Not scheduled";

        const match = String(time).match(/^(\d{1,2}):(\d{2})/);
        if (!match) return time;

        let hours = Number(match[1]);
        const minutes = match[2];
        const period = hours >= 12 ? "PM" : "AM";

        hours = hours % 12 || 12;

        return `${String(hours).padStart(2, "0")}:${minutes} ${period}`;
    }

    // 3. Display messages
    function showMessage(message, type = "info") {
        let box = document.getElementById("pickupMessage");

        if (!box) {
            box = document.createElement("div");
            box.id = "pickupMessage";

            const container =
                document.querySelector("main") ||
                document.querySelector(".container") ||
                document.body;

            container.prepend(box);
        }

        box.textContent = message;
        box.className = `alert alert-${type} mt-3`;
        box.classList.remove("d-none");
        box.setAttribute("role", "alert");
    }

    // 4. API request helper
    async function apiRequest(url, method = "GET", body = null) {
        const token = getToken();

        if (!token) {
            throw new Error("Your login session is missing. Please log in again.");
        }

        const headers = {
            Authorization: `Bearer ${token}`,
            Accept: "application/json"
        };

        const options = { method, headers };

        if (body !== null) {
            headers["Content-Type"] = "application/json";
            options.body = JSON.stringify(body);
        }

        let response;

        try {
            response = await fetch(url, options);
        } catch (error) {
            console.error("Network error:", error);
            throw new Error(
                "Unable to connect. Check that the Django server is running."
            );
        }

        const responseText = await response.text();
        let result = {};

        try {
            result = responseText ? JSON.parse(responseText) : {};
        } catch {
            result = { message: responseText };
        }

        if (response.status === 401) {
            throw new Error(
                "Your session has expired. Please log in again."
            );
        }

        if (response.status === 403) {
            throw new Error(
                result.detail ||
                result.message ||
                "You do not have permission to perform this action."
            );
        }

        if (!response.ok || result.success === false) {
            const errors = result.errors || result;
            const detail =
                result.message ||
                result.detail ||
                (typeof errors === "string"
                    ? errors
                    : JSON.stringify(errors));

            throw new Error(
                detail || `Request failed (${response.status}).`
            );
        }

        return result;
    }

    // 5. Status badge
    function createStatusBadge(status) {
        const badge = document.createElement("span");
        badge.className = "badge ms-2";

        const styles = {
            SCHEDULED: "text-bg-primary",
            IN_PROGRESS: "text-bg-warning",
            PICKED_UP: "text-bg-info",
            COMPLETED: "text-bg-success",
            FAILED: "text-bg-danger"
        };

        badge.classList.add(styles[status] || "text-bg-secondary");
        badge.textContent = status || "UNKNOWN";

        return badge;
    }

    // 6. Create a safe action button
    function createActionButton(text, className, attribute, id) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = `btn ${className} btn-sm`;
        button.textContent = text;
        button.setAttribute(attribute, id);

        return button;
    }

    // 7. Load and display pickups
    async function loadPickups() {
        const list = document.getElementById("pickupList");
        if (!list) return;

        list.textContent = "Loading pickups...";

        const refreshButton = document.getElementById("refreshPickups");

        if (refreshButton) {
            refreshButton.disabled = true;
        }

        try {
            const result = await apiRequest(API, "GET");

            const pickups = Array.isArray(result)
                ? result
                : result.data || result.results || [];

            list.replaceChildren();

            if (!Array.isArray(pickups) || pickups.length === 0) {
                const emptyMessage = document.createElement("p");
                emptyMessage.className = "text-muted py-3 mb-0";
                emptyMessage.textContent = "No pickups found yet.";
                list.appendChild(emptyMessage);
                return;
            }

            const role = getRole();

            pickups.forEach(pickup => {
                const card = document.createElement("div");
                card.className = "border rounded p-3 mb-3";

                const headingRow = document.createElement("div");
                headingRow.className =
                    "d-flex flex-wrap align-items-center gap-2 mb-2";

                const heading = document.createElement("h6");
                heading.className = "fw-bold mb-0";
                heading.textContent = `Pickup #${pickup.id}`;

                headingRow.append(
                    heading,
                    createStatusBadge(pickup.status)
                );

                const details = document.createElement("p");
                details.className = "mb-3";

                details.textContent =
                    `Request: ${pickup.food_request ?? "N/A"} | ` +
                    `Date: ${pickup.pickup_date || "Not scheduled"} | ` +
                    `Time: ${formatPickupTime(pickup.pickup_time)} | ` +
                    `Code: ${pickup.pickup_code || "N/A"}`;

                card.append(headingRow, details);

                const actions = document.createElement("div");
                actions.className = "d-flex flex-wrap gap-2";

                // Receiver confirms that food has been collected.
                if (
                    role === "RECEIVER" &&
                    pickup.status === "SCHEDULED"
                ) {
                    actions.appendChild(
                        createActionButton(
                            "Confirm Collection",
                            "btn-outline-success",
                            "data-mark-picked-up",
                            pickup.id
                        )
                    );
                }

                // Complete a pickup only after it has been picked up.
                if (
                    ["DONOR", "RECEIVER"].includes(role) &&
                    pickup.status === "PICKED_UP"
                ) {
                    actions.appendChild(
                        createActionButton(
                            "Complete Pickup",
                            "btn-success",
                            "data-complete-pickup",
                            pickup.id
                        )
                    );
                }

                if (actions.childElementCount > 0) {
                    card.appendChild(actions);
                } else if (pickup.status === "COMPLETED") {
                    const completedMessage = document.createElement("p");
                    completedMessage.className =
                        "text-success small mb-0";
                    completedMessage.textContent =
                        "This pickup has been completed.";
                    card.appendChild(completedMessage);
                }

                list.appendChild(card);
            });
        } catch (error) {
            console.error("Loading pickups failed:", error);
            list.replaceChildren();

            const errorMessage = document.createElement("p");
            errorMessage.className = "text-danger mb-0";
            errorMessage.textContent = error.message;
            list.appendChild(errorMessage);
        } finally {
            if (refreshButton) {
                refreshButton.disabled = false;
            }
        }
    }

    window.loadPickups = loadPickups;
    window.foodSharePickupApi = apiRequest;

    document.getElementById("refreshPickups")
        ?.addEventListener("click", loadPickups);

    // 8. Schedule a pickup (donor)
    const scheduleForm = document.getElementById("schedulePickupForm");

    scheduleForm?.addEventListener("submit", async event => {
        event.preventDefault();

        if (getRole() !== "DONOR") {
            showMessage(
                "Only donors can schedule pickups.",
                "danger"
            );
            return;
        }

        const submitButton = scheduleForm.querySelector(
            'button[type="submit"]'
        );

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Scheduling...";
        }

        try {
            const form = scheduleForm.elements;

            const data = {
                food_request: Number(form.food_request.value),
                pickup_date: form.pickup_date.value,
                pickup_time: form.pickup_time.value,
                volunteer_name: form.volunteer_name.value.trim(),
                volunteer_phone: form.volunteer_phone.value.trim()
            };

            if (
                !Number.isInteger(data.food_request) ||
                data.food_request <= 0 ||
                !data.pickup_date ||
                !data.pickup_time
            ) {
                throw new Error(
                    "Enter a valid request ID, pickup date, and pickup time."
                );
            }

            const result = await apiRequest(API, "POST", data);
            const pickup = result.data || result;

            showMessage(
                `Pickup scheduled successfully! Code: ${
                    pickup.pickup_code || "N/A"
                }`,
                "success"
            );

            scheduleForm.reset();
            await loadPickups();
        } catch (error) {
            console.error("Schedule pickup error:", error);
            showMessage(error.message, "danger");
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = "Schedule Pickup";
            }
        }
    });

    // 9. Receiver confirms collection
    document.addEventListener("click", async event => {
        const button = event.target.closest("[data-mark-picked-up]");
        if (!button) return;

        if (getRole() !== "RECEIVER") {
            showMessage(
                "Only the assigned receiver can confirm collection.",
                "danger"
            );
            return;
        }

        button.disabled = true;

        try {
            const id = encodeURIComponent(button.dataset.markPickedUp);

            const result = await apiRequest(
                `${API}${id}/mark-picked-up/`,
                "POST"
            );

            showMessage(
                result.message || "Food collection confirmed.",
                "success"
            );

            await loadPickups();
        } catch (error) {
            console.error("Collection confirmation error:", error);
            showMessage(error.message, "danger");
        } finally {
            button.disabled = false;
        }
    });

    // 10. Complete a pickup
    document.addEventListener("click", async event => {
        const button = event.target.closest("[data-complete-pickup]");
        if (!button) return;

        if (!["DONOR", "RECEIVER"].includes(getRole())) {
            showMessage(
                "You do not have permission to complete this pickup.",
                "danger"
            );
            return;
        }

        if (
            !window.confirm(
                "Are you sure you want to complete this pickup?"
            )
        ) {
            return;
        }

        button.disabled = true;

        try {
            const id = encodeURIComponent(button.dataset.completePickup);

            const result = await apiRequest(
                `${API}${id}/complete/`,
                "POST"
            );

            showMessage(
                result.message || "Pickup completed successfully.",
                "success"
            );

            await loadPickups();
        } catch (error) {
            console.error("Complete pickup error:", error);
            showMessage(error.message, "danger");
        } finally {
            button.disabled = false;
        }
    });

    // 11. Initial page load
    if (!getUser() || !getToken()) {
        const list = document.getElementById("pickupList");

        if (list) {
            list.textContent =
                "Please log in again to view your pickup records.";
        }

        return;
    }

    loadPickups();
});
