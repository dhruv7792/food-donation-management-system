/* =========================================================
   FOODSHARE MAIN JAVASCRIPT
   ========================================================= */


document.addEventListener("DOMContentLoaded", function () {

    initializeTheme();

});


/* =========================================================
   THEME SYSTEM
   ========================================================= */

function initializeTheme() {

    const themeToggle =
        document.getElementById("themeToggle");

    const themeIcon =
        document.getElementById("themeIcon");

    const themeText =
        document.getElementById("themeText");


    /* Button does not exist */

    if (!themeToggle) {

        console.log(
            "FoodShare: Theme button not found."
        );

        return;
    }


    /* --------------------------------
       Update button
       -------------------------------- */

    function updateThemeButton(theme) {

        if (theme === "dark") {

            themeIcon.className =
                "bi bi-sun-fill";

            themeText.textContent =
                "Light";

        } else {

            themeIcon.className =
                "bi bi-moon-fill";

            themeText.textContent =
                "Dark";

        }

    }


    /* --------------------------------
       Get saved theme
       -------------------------------- */

    let savedTheme =
        localStorage.getItem(
            "foodshare-theme"
        );


    /* Default */

    if (!savedTheme) {

        savedTheme = "light";

    }


    /* --------------------------------
       Apply saved theme
       -------------------------------- */

    if (savedTheme === "dark") {

        document.documentElement
            .setAttribute(
                "data-theme",
                "dark"
            );

    } else {

        document.documentElement
            .removeAttribute(
                "data-theme"
            );

    }


    updateThemeButton(savedTheme);


    /* --------------------------------
       Button click
       -------------------------------- */

    themeToggle.addEventListener(
        "click",
        function () {

            const currentTheme =
                document.documentElement
                    .getAttribute(
                        "data-theme"
                    );


            if (currentTheme === "dark") {

                /* LIGHT */

                document.documentElement
                    .removeAttribute(
                        "data-theme"
                    );

                localStorage.setItem(
                    "foodshare-theme",
                    "light"
                );

                updateThemeButton(
                    "light"
                );


            } else {

                /* DARK */

                document.documentElement
                    .setAttribute(
                        "data-theme",
                        "dark"
                    );

                localStorage.setItem(
                    "foodshare-theme",
                    "dark"
                );

                updateThemeButton(
                    "dark"
                );

            }

        }
    );

}


/* =========================================================
   GLOBAL UTILITIES & HELPERS
   ========================================================= */

function escapeHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDate(dateStr) {
    if (!dateStr) return "-";
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    } catch (e) {
        return dateStr;
    }
}

function statusBadge(status) {
    if (!status) return '<span class="badge bg-secondary">Unknown</span>';
    const s = String(status).toUpperCase();
    switch (s) {
        case "AVAILABLE":
            return '<span class="badge bg-success-subtle text-success border border-success-subtle">Available</span>';
        case "REQUESTED":
            return '<span class="badge bg-warning-subtle text-warning border border-warning-subtle">Requested</span>';
        case "ACCEPTED":
            return '<span class="badge bg-info-subtle text-info border border-info-subtle">Accepted</span>';
        case "PICKED_UP":
            return '<span class="badge bg-primary-subtle text-primary border border-primary-subtle">Picked Up</span>';
        case "COMPLETED":
            return '<span class="badge bg-success border">Completed</span>';
        case "CANCELLED":
            return '<span class="badge bg-danger-subtle text-danger border border-danger-subtle">Cancelled</span>';
        case "EXPIRED":
            return '<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle">Expired</span>';
        default:
            return `<span class="badge bg-light text-dark border">${escapeHTML(s)}</span>`;
    }
}

function showMessage(message, type = "info", containerId = null) {
    const alertType = type === "danger" || type === "error" ? "danger" : (type === "success" ? "success" : "warning");
    const html = `
        <div class="alert alert-${alertType} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    const target = containerId
        ? document.getElementById(containerId)
        : document.querySelector("#donationMessage, #dashboardMessage, #listMessage, #requestMessage, .alert-container");

    if (target) {
        target.innerHTML = html;
        target.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
        alert(message);
    }
}

function setButtonLoading(buttonOrId, isLoadingOrTextId, maybeTextOrSpinnerId, maybeIsLoading, maybeLoadingText) {
    let btn = typeof buttonOrId === "string" ? document.getElementById(buttonOrId) : buttonOrId;
    if (!btn) return;

    if (typeof isLoadingOrTextId === "boolean") {
        const isLoading = isLoadingOrTextId;
        const text = maybeTextOrSpinnerId || "Loading...";
        if (isLoading) {
            btn.dataset.originalHtml = btn.dataset.originalHtml || btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>${text}`;
        } else {
            btn.disabled = false;
            if (btn.dataset.originalHtml) {
                btn.innerHTML = btn.dataset.originalHtml;
            }
        }
        return;
    }

    const textEl = document.getElementById(isLoadingOrTextId);
    const spinnerEl = document.getElementById(maybeTextOrSpinnerId);
    const isLoading = Boolean(maybeIsLoading);
    const text = maybeLoadingText;

    btn.disabled = isLoading;
    if (spinnerEl) spinnerEl.classList.toggle("d-none", !isLoading);
    if (textEl && text) textEl.textContent = text;
}

function setupImagePreview(inputId, previewImgId) {
    const input = document.getElementById(inputId) || document.getElementById("foodImage");
    const preview = document.getElementById(previewImgId) || document.getElementById("imagePreview");
    if (!input || !preview) return;

    input.addEventListener("change", function () {
        const file = this.files && this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                preview.src = e.target.result;
                const container = document.getElementById("imagePreviewContainer");
                if (container) container.classList.remove("d-none");
            };
            reader.readAsDataURL(file);
        } else {
            preview.src = "";
            const container = document.getElementById("imagePreviewContainer");
            if (container) container.classList.add("d-none");
        }
    });
}