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
        document.documentElement.setAttribute("data-theme", "dark");
        document.documentElement.setAttribute("data-bs-theme", "dark");
        if (document.body) document.body.classList.add("dark");
    } else {
        document.documentElement.setAttribute("data-theme", "light");
        document.documentElement.setAttribute("data-bs-theme", "light");
        if (document.body) document.body.classList.remove("dark");
    }

    updateThemeButton(savedTheme);


    /* --------------------------------
       Button click
       -------------------------------- */

    themeToggle.addEventListener(
        "click",
        function () {

            const currentTheme =
                document.documentElement.getAttribute("data-theme") || "light";

            if (currentTheme === "dark") {

                /* LIGHT */

                document.documentElement.setAttribute("data-theme", "light");
                document.documentElement.setAttribute("data-bs-theme", "light");
                if (document.body) document.body.classList.remove("dark");

                localStorage.setItem(
                    "foodshare-theme",
                    "light"
                );

                updateThemeButton("light");

            } else {

                /* DARK */

                document.documentElement.setAttribute("data-theme", "dark");
                document.documentElement.setAttribute("data-bs-theme", "dark");
                if (document.body) document.body.classList.add("dark");

                localStorage.setItem(
                    "foodshare-theme",
                    "dark"
                );

                updateThemeButton("dark");

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


/* =========================================================
   NOTIFICATION SYSTEM
   Real-time polling for in-app notifications.
   - Polls /api/v1/notifications/ every 20 seconds
   - Shows toast popup for brand-new notifications
   - Updates the bell badge count
   - Renders a dropdown list of recent notifications
   ========================================================= */

const NotificationSystem = (() => {

    const API_URL       = "/api/v1/notifications/";
    const COUNT_URL     = "/api/v1/notifications/unread-count/";
    const MARK_ALL_URL  = "/api/v1/notifications/mark-all-read/";
    const MARK_ONE_BASE = "/api/v1/notifications/";
    const POLL_MS       = 20000;   // 20 seconds
    const MAX_DROPDOWN  = 10;      // items shown in dropdown
    const TOAST_DURATION= 6000;    // ms toast stays visible

    let _knownIds    = new Set();
    let _pollTimer   = null;
    let _initialized = false;

    // ---- Icon map per notification type ----
    function _icon(type) {
        switch ((type || "").toUpperCase()) {
            case "REQUEST":   return "🍽️";
            case "ACCEPTED":  return "🎉";
            case "REJECTED":  return "⛔";
            case "PICKUP":    return "🚗";
            case "COMPLETED": return "✅";
            case "EXPIRY":    return "⏰";
            default:          return "🔔";
        }
    }

    // ---- Relative time ----
    function _timeAgo(isoStr) {
        try {
            const diff = Date.now() - new Date(isoStr).getTime();
            const mins = Math.floor(diff / 60000);
            if (mins < 1)  return "just now";
            if (mins < 60) return `${mins}m ago`;
            const hrs = Math.floor(mins / 60);
            if (hrs < 24)  return `${hrs}h ago`;
            return `${Math.floor(hrs / 24)}d ago`;
        } catch { return ""; }
    }

    // ---- Get access token (from auth.js TokenManager if loaded) ----
    function _getToken() {
        if (typeof TokenManager !== "undefined") return TokenManager.getAccessToken();
        return localStorage.getItem("access_token") || sessionStorage.getItem("access_token") || "";
    }

    // ---- Authenticated fetch wrapper ----
    async function _apiFetch(url, opts = {}) {
        const token = _getToken();
        const headers = { "Accept": "application/json", ...(opts.headers || {}) };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        if (opts.body && !(opts.body instanceof FormData)) {
            headers["Content-Type"] = "application/json";
        }
        // Add CSRF
        const csrf = (() => {
            const m = document.cookie.match(/csrftoken=([^;]+)/);
            return m ? decodeURIComponent(m[1]) : "";
        })();
        if (csrf) headers["X-CSRFToken"] = csrf;

        const r = await fetch(url, { ...opts, headers });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
    }

    // ---- Show a toast popup ----
    function _showToast(notif) {
        // Build toast container if missing
        let container = document.getElementById("fsToastContainer");
        if (!container) {
            container = document.createElement("div");
            container.id = "fsToastContainer";
            container.style.cssText = [
                "position:fixed",
                "top:70px",
                "right:20px",
                "z-index:9999",
                "display:flex",
                "flex-direction:column",
                "gap:10px",
                "max-width:360px",
            ].join(";");
            document.body.appendChild(container);
        }

        const icon = _icon(notif.notification_type);
        const toast = document.createElement("div");
        toast.style.cssText = [
            "background:#fff",
            "border:1px solid #e0e0e0",
            "border-left:4px solid #2e7d32",
            "border-radius:12px",
            "padding:14px 16px",
            "box-shadow:0 4px 20px rgba(0,0,0,0.12)",
            "cursor:pointer",
            "animation:fsSlideIn 0.35s ease",
            "color:#333",
        ].join(";");
        toast.innerHTML = `
            <div style="display:flex;align-items:flex-start;gap:10px;">
                <span style="font-size:1.5rem;line-height:1;">${icon}</span>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:600;font-size:0.88rem;margin-bottom:3px;
                                overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                        ${escapeHTMLNotif(notif.title)}
                    </div>
                    <div style="font-size:0.8rem;color:#555;line-height:1.4;
                                display:-webkit-box;-webkit-line-clamp:2;
                                -webkit-box-orient:vertical;overflow:hidden;">
                        ${escapeHTMLNotif(notif.message)}
                    </div>
                    <div style="font-size:0.72rem;color:#aaa;margin-top:4px;">${_timeAgo(notif.created_at)}</div>
                </div>
                <button onclick="this.parentElement.parentElement.remove()"
                        style="background:none;border:none;cursor:pointer;color:#aaa;
                               font-size:1rem;padding:0;line-height:1;flex-shrink:0;">×</button>
            </div>`;
        toast.addEventListener("click", (e) => {
            if (e.target.tagName !== "BUTTON") {
                _markOneRead(notif.id);
                toast.remove();
            }
        });
        container.appendChild(toast);
        setTimeout(() => toast.remove(), TOAST_DURATION);
    }

    function escapeHTMLNotif(str) {
        return String(str || "")
            .replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;")
            .replace(/"/g,"&quot;");
    }

    // ---- Render dropdown list ----
    function _renderDropdown(notifications) {
        const container  = document.getElementById("notifListContainer");
        const emptyMsg   = document.getElementById("notifEmptyMsg");
        const badge      = document.getElementById("notifBadge");
        if (!container) return;

        const unread = notifications.filter(n => !n.is_read).length;

        // Badge
        if (badge) {
            if (unread > 0) {
                badge.textContent = unread > 99 ? "99+" : unread;
                badge.classList.remove("d-none");
            } else {
                badge.classList.add("d-none");
            }
        }

        const recent = notifications.slice(0, MAX_DROPDOWN);
        if (recent.length === 0) {
            if (emptyMsg) emptyMsg.style.display = "";
            return;
        }
        if (emptyMsg) emptyMsg.style.display = "none";

        // Clear old items (keep empty msg node)
        const existing = container.querySelectorAll(".fs-notif-item");
        existing.forEach(el => el.remove());

        recent.forEach(notif => {
            const li = document.createElement("li");
            li.className = "fs-notif-item";
            li.style.cssText = `
                border-bottom:1px solid #f5f5f5;
                background:${notif.is_read ? "transparent" : "rgba(46,125,50,0.04)"};
                cursor:pointer;
                transition:background 0.2s;
            `;
            li.innerHTML = `
                <div class="d-flex align-items-start gap-2 px-3 py-2">
                    <span style="font-size:1.3rem;line-height:1;flex-shrink:0;">${_icon(notif.notification_type)}</span>
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:${notif.is_read ? "400" : "600"};
                                    font-size:0.82rem;
                                    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                            ${escapeHTMLNotif(notif.title)}
                        </div>
                        <div style="font-size:0.76rem;color:#666;
                                    line-height:1.35;
                                    display:-webkit-box;-webkit-line-clamp:2;
                                    -webkit-box-orient:vertical;overflow:hidden;">
                            ${escapeHTMLNotif(notif.message)}
                        </div>
                        <div style="font-size:0.68rem;color:#aaa;margin-top:2px;">${_timeAgo(notif.created_at)}</div>
                    </div>
                    ${notif.is_read ? "" : '<span style="width:7px;height:7px;border-radius:50%;background:#2e7d32;flex-shrink:0;margin-top:4px;"></span>'}
                </div>`;
            li.addEventListener("click", () => {
                _markOneRead(notif.id);
                li.style.background = "transparent";
                li.querySelector("span[style*='7px']") && li.querySelector("span[style*='7px']").remove();
            });
            container.insertBefore(li, emptyMsg);
        });
    }

    // ---- Mark one notification as read ----
    async function _markOneRead(id) {
        try {
            await _apiFetch(`${MARK_ONE_BASE}${id}/read/`, { method: "PATCH", body: JSON.stringify({ is_read: true }) });
        } catch { /* silent */ }
    }

    // ---- Mark all read ----
    async function _markAllRead() {
        try {
            await _apiFetch(MARK_ALL_URL, { method: "POST" });
            const badge = document.getElementById("notifBadge");
            if (badge) badge.classList.add("d-none");
            document.querySelectorAll(".fs-notif-item").forEach(el => {
                el.style.background = "transparent";
                const dot = el.querySelector("span[style*='7px']");
                if (dot) dot.remove();
            });
        } catch { /* silent */ }
    }

    // ---- Main poll function ----
    async function _poll() {
        try {
            const data = await _apiFetch(API_URL);
            const notifications = (data.results || data) || [];
            if (!Array.isArray(notifications)) return;

            // Find brand-new ones (not yet seen)
            const isFirstLoad = _knownIds.size === 0;
            notifications.forEach(n => {
                if (!_knownIds.has(n.id)) {
                    _knownIds.add(n.id);
                    // Only toast on subsequent polls (not first load)
                    if (!isFirstLoad && !n.is_read) {
                        _showToast(n);
                    }
                }
            });

            _renderDropdown(notifications);
        } catch (err) {
            // Silently fail (user may not be logged in via JWT)
            console.debug("Notification poll skipped:", err.message);
        }
    }

    // ---- Public init ----
    function init() {
        if (_initialized) return;
        const bell = document.getElementById("notificationBell");
        if (!bell) return;   // Not on a page with the navbar bell

        _initialized = true;

        // Wire mark-all-read button
        const markAllBtn = document.getElementById("markAllReadBtn");
        if (markAllBtn) markAllBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            _markAllRead();
        });

        // Initial poll + periodic polling
        _poll();
        _pollTimer = setInterval(_poll, POLL_MS);

        // Refresh when user opens the dropdown
        bell.addEventListener("click", () => setTimeout(_poll, 100));
    }

    return { init };
})();


/* Keyframe animation for toast slide-in */
(function () {
    const style = document.createElement("style");
    style.textContent = `
        @keyframes fsSlideIn {
            from { opacity:0; transform:translateX(30px); }
            to   { opacity:1; transform:translateX(0); }
        }
    `;
    document.head.appendChild(style);
})();


document.addEventListener("DOMContentLoaded", () => {
    NotificationSystem.init();
});