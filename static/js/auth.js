
console.log("FoodShare Auth JS loaded");

"use strict";

/* =========================================================
   API CONFIGURATION
========================================================= */

const AUTH_API = {
    login: "/api/v1/auth/login/",
    register: "/api/v1/auth/register/",
    logout: "/api/v1/auth/logout/",
    me: "/api/v1/auth/me/",
    passwordReset: "/api/v1/auth/password-reset/"
};


/* =========================================================
   TOKEN MANAGEMENT
========================================================= */

const TokenManager = {

    getAccessToken() {
        return (
            localStorage.getItem("access_token") ||
            sessionStorage.getItem("access_token")
        );
    },

    getRefreshToken() {
        return (
            localStorage.getItem("refresh_token") ||
            sessionStorage.getItem("refresh_token")
        );
    },

    save(accessToken, refreshToken, remember = true) {

        this.clear();

        localStorage.setItem("access_token", accessToken);
        sessionStorage.setItem("access_token", accessToken);

        if (refreshToken) {
            localStorage.setItem("refresh_token", refreshToken);
            sessionStorage.setItem("refresh_token", refreshToken);
        }

        localStorage.setItem(
            "remember_me",
            remember ? "true" : "false"
        );
    },

    clear() {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("remember_me");
        localStorage.removeItem("user");

        sessionStorage.removeItem("access_token");
        sessionStorage.removeItem("refresh_token");
        sessionStorage.removeItem("user");
    },

    isAuthenticated() {
        return Boolean(this.getAccessToken());
    },

    getUser() {
        try {
            return JSON.parse(
                localStorage.getItem("user") ||
                sessionStorage.getItem("user") ||
                "null"
            );
        } catch (e) {
            return null;
        }
    },

    getUserName() {
        const user = this.getUser();
        if (!user) return "";
        return user.first_name || user.username || (user.email ? user.email.split("@")[0] : "");
    }
};


/* =========================================================
   API REQUEST HELPER
========================================================= */

function getCsrfToken() {
    const metaOrInput = document.querySelector('[name=csrfmiddlewaretoken]');
    if (metaOrInput) return metaOrInput.value;
    const match = document.cookie.match(/csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : "";
}

function resolveApiUrl(url) {
    if (typeof url !== "string" || !url.startsWith("/")) return url;
    if (url.startsWith("/api/v1/")) return url;

    if (url.startsWith("/dashboard/")) return `/api/v1${url}`;
    if (url.startsWith("/donations/")) {
        const sub = url.replace(/^\/donations\/?/, "");
        return `/api/v1/donations/${sub}`;
    }
    if (url.startsWith("/requests/")) {
        const sub = url.replace(/^\/requests\/?/, "");
        return `/api/v1/requests/${sub}`;
    }
    if (url.startsWith("/pickups/")) {
        const sub = url.replace(/^\/pickups\/?/, "");
        return `/api/v1/pickups/${sub}`;
    }
    if (url.startsWith("/auth/")) {
        const sub = url.replace(/^\/auth\/?/, "");
        return `/api/v1/auth/${sub}`;
    }
    if (url.startsWith("/notifications/")) {
        const sub = url.replace(/^\/notifications\/?/, "");
        return `/api/v1/notifications/${sub}`;
    }
    return url;
}

async function apiRequest(url, options = {}) {

    const resolvedUrl = resolveApiUrl(url);
    const token = TokenManager.getAccessToken();

    const headers = {
        "Accept": "application/json",
        ...options.headers
    };

    const csrfToken = getCsrfToken();
    if (csrfToken && !headers["X-CSRFToken"]) {
        headers["X-CSRFToken"] = csrfToken;
    }

    if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }

    // Login and registration must not send old JWT tokens.
    if (token && options.auth !== false) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const requestOptions = { ...options };

    delete requestOptions.auth;

    const response = await fetch(resolvedUrl, {
        ...requestOptions,
        headers
    });

    let data = {};

    try {
        data = await response.json();
    } catch (error) {
        data = {};
    }

    if (!response.ok) {

        const error = new Error(
            data.detail ||
            data.message ||
            "Something went wrong."
        );

        error.status = response.status;
        error.data = data;

        throw error;
    }

    return data;
}


/* =========================================================
   ERROR MESSAGE FORMATTER
========================================================= */

function getApiErrorMessage(error) {

    if (!error) {
        return "Something went wrong.";
    }

    const data = error.data;

    if (data) {

        if (typeof data === "string") {
            return data;
        }

        if (data.detail) {
            return data.detail;
        }

        if (data.message) {
            return data.message;
        }

        const messages = [];

        Object.keys(data).forEach(key => {

            const value = data[key];

            if (Array.isArray(value)) {
                messages.push(`${key}: ${value.join(", ")}`);
            } else if (typeof value === "string") {
                messages.push(`${key}: ${value}`);
            } else if (value && typeof value === "object") {
                messages.push(`${key}: ${JSON.stringify(value)}`);
            }

        });

        if (messages.length) {
            return messages.join("<br>");
        }
    }

    return error.message || "Something went wrong.";
}


/* =========================================================
   ALERT HELPER
========================================================= */

function showAlert(elementId, message, type = "danger") {

    const alertElement = document.getElementById(elementId);

    if (!alertElement) {
        return;
    }

    alertElement.className = `alert alert-${type}`;
    alertElement.innerHTML = message;
    alertElement.classList.remove("d-none");

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


function hideAlert(elementId) {

    const alertElement = document.getElementById(elementId);

    if (alertElement) {
        alertElement.classList.add("d-none");
    }
}


/* =========================================================
   BUTTON LOADING
========================================================= */

function setButtonLoading(
    buttonId,
    textId,
    spinnerId,
    loading,
    loadingText = "Please wait..."
) {

    const button = document.getElementById(buttonId);
    const text = document.getElementById(textId);
    const spinner = document.getElementById(spinnerId);

    if (!button) {
        return;
    }

    if (text && !text.dataset.originalText) {
        text.dataset.originalText = text.textContent;
    }

    button.disabled = loading;

    if (text) {
        text.textContent = loading
            ? loadingText
            : text.dataset.originalText;
    }

    if (spinner) {
        spinner.classList.toggle("d-none", !loading);
    }
}


/* =========================================================
   PASSWORD VISIBILITY
========================================================= */

function setupPasswordToggle(buttonId, inputId) {

    const button = document.getElementById(buttonId);
    const input = document.getElementById(inputId);

    if (!button || !input) {
        return;
    }

    button.addEventListener("click", () => {

        const icon = button.querySelector("i");

        if (input.type === "password") {

            input.type = "text";

            if (icon) {
                icon.className = "bi bi-eye-slash";
            }

        } else {

            input.type = "password";

            if (icon) {
                icon.className = "bi bi-eye";
            }
        }
    });
}


/* =========================================================
   ROLE-BASED REDIRECTION
========================================================= */

function redirectAfterLogin(user) {

    if (!user) {
        window.location.href = "/";
        return;
    }

    try {
        localStorage.setItem("user", JSON.stringify(user));
        sessionStorage.setItem("user", JSON.stringify(user));
    } catch (e) { }

    const role = String(
        user.role ||
        user.user_type ||
        user.account_type ||
        ""
    ).toUpperCase();

    if (
        role === "ADMIN" ||
        user.is_staff === true ||
        user.is_superuser === true
    ) {
        window.location.href = "/management/";
    } else if (role === "DONOR") {
        window.location.href = "/donor/";
    } else if (role === "RECEIVER") {
        window.location.href = "/receiver/";
    } else {
        window.location.href = "/";
    }
}


/* =========================================================
   LOGIN
========================================================= */

function initializeLogin() {

    const form = document.getElementById("loginForm");

    if (!form) {
        return;
    }

    setupPasswordToggle(
        "toggleLoginPassword",
        "loginPassword"
    );

    setupPasswordToggle(
        "showPassword",
        "loginPassword"
    );

    form.addEventListener("submit", async event => {

        event.preventDefault();

        hideAlert("loginAlert");

        if (!form.checkValidity()) {
            form.classList.add("was-validated");
            return;
        }

        const email = document
            .getElementById("loginEmail")
            .value.trim();

        const password = document
            .getElementById("loginPassword")
            .value;

        const rememberEl = document.getElementById("rememberMe") || document.getElementById("remember");
        const remember = rememberEl ? rememberEl.checked : false;

        setButtonLoading(
            "loginButton",
            "loginButtonText",
            "loginSpinner",
            true,
            "Signing In..."
        );

        try {

            const response = await apiRequest(
                AUTH_API.login,
                {
                    method: "POST",
                    auth: false,
                    body: JSON.stringify({
                        email: email,
                        password: password
                    })
                }
            );

            const responseData = response.data || response;

            const accessToken =
                responseData.access ||
                responseData.access_token ||
                responseData.token;

            const refreshToken =
                responseData.refresh ||
                responseData.refresh_token;

            const user = responseData.user || null;

            if (!accessToken) {
                throw new Error(
                    "Access token not received from server."
                );
            }

            TokenManager.save(
                accessToken,
                refreshToken,
                remember
            );

            showAlert(
                "loginAlert",
                "Login successful. Redirecting...",
                "success"
            );

            setTimeout(() => {
                redirectAfterLogin(user);
            }, 700);

        } catch (error) {

            console.error("Login error:", error);

            showAlert(
                "loginAlert",
                getApiErrorMessage(error),
                "danger"
            );

        } finally {

            setButtonLoading(
                "loginButton",
                "loginButtonText",
                "loginSpinner",
                false
            );
        }
    });
}


/* =========================================================
   REGISTER INITIALIZATION
========================================================= */

function initializeRegister() {

    const form = document.getElementById("registerForm");

    if (!form) {
        return;
    }

    setupPasswordToggle(
        "toggleRegisterPassword",
        "registerPassword"
    );

    setupPasswordToggle(
        "toggleConfirmPassword",
        "confirmPassword"
    );

    // Role selection
    const roleCards = document.querySelectorAll(".role-card");

    roleCards.forEach(card => {

        card.addEventListener("click", () => {

            roleCards.forEach(item => {
                item.classList.remove("active");
            });

            card.classList.add("active");

            const radio = card.querySelector(
                'input[type="radio"]'
            );

            if (radio) {
                radio.checked = true;
            }
        });
    });

    // Password strength
    const password = document.getElementById("registerPassword");

    if (password) {
        password.addEventListener("input", updatePasswordStrength);
    }

    // Password match
    const confirmPassword = document.getElementById("confirmPassword");

    if (confirmPassword) {
        confirmPassword.addEventListener("input", checkPasswordMatch);
    }

    // Profile image preview
    const profileImage = document.getElementById("profileImage");

    if (profileImage) {
        profileImage.addEventListener("change", previewProfileImage);
    }

    form.addEventListener("submit", handleRegister);
}


/* =========================================================
   PASSWORD STRENGTH
========================================================= */

function updatePasswordStrength() {

    const password = document.getElementById("registerPassword");
    const bar = document.getElementById("passwordStrengthBar");
    const text = document.getElementById("passwordStrengthText");

    if (!password || !bar || !text) {
        return;
    }

    const value = password.value;

    let score = 0;

    if (value.length >= 8) score++;
    if (/[A-Z]/.test(value)) score++;
    if (/[a-z]/.test(value)) score++;
    if (/[0-9]/.test(value)) score++;
    if (/[^A-Za-z0-9]/.test(value)) score++;

    bar.style.width = `${score * 20}%`;

    if (score <= 1) {

        text.textContent = "Weak password";
        bar.style.backgroundColor = "#dc3545";

    } else if (score <= 3) {

        text.textContent = "Medium password";
        bar.style.backgroundColor = "#ffc107";

    } else {

        text.textContent = "Strong password";
        bar.style.backgroundColor = "#198754";
    }
}


/* =========================================================
   PASSWORD MATCH
========================================================= */

function checkPasswordMatch() {

    const password = document.getElementById("registerPassword");
    const confirm = document.getElementById("confirmPassword");
    const message = document.getElementById("passwordMatchMessage");

    if (!password || !confirm || !message) {
        return;
    }

    if (!confirm.value) {

        message.textContent = "";
        confirm.classList.remove("is-valid", "is-invalid");

        return;
    }

    if (password.value === confirm.value) {

        message.textContent = "Passwords match.";
        message.className = "small mt-1 text-success";

        confirm.classList.remove("is-invalid");
        confirm.classList.add("is-valid");

    } else {

        message.textContent = "Passwords do not match.";
        message.className = "small mt-1 text-danger";

        confirm.classList.remove("is-valid");
        confirm.classList.add("is-invalid");
    }
}


/* =========================================================
   PROFILE IMAGE PREVIEW
========================================================= */

function previewProfileImage(event) {

    const file = event.target.files[0];

    const preview = document.getElementById("profilePreview");

    if (!file || !preview) {
        return;
    }

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {

        event.target.value = "";

        showAlert(
            "registerAlert",
            "Please select a JPG, PNG or WEBP image.",
            "danger"
        );

        return;
    }

    if (file.size > 5 * 1024 * 1024) {

        event.target.value = "";

        showAlert(
            "registerAlert",
            "Profile image must be smaller than 5 MB.",
            "danger"
        );

        return;
    }

    const reader = new FileReader();

    reader.onload = function (e) {
        preview.src = e.target.result;
        preview.style.display = "block";
    };

    reader.readAsDataURL(file);
}


/* =========================================================
   REGISTER SUBMISSION
========================================================= */

async function handleRegister(event) {

    event.preventDefault();

    const form = event.target;

    hideAlert("registerAlert");

    if (!form.checkValidity()) {
        form.classList.add("was-validated");
        return;
    }

    const password = document
        .getElementById("registerPassword")
        .value;

    const confirmPassword = document
        .getElementById("confirmPassword")
        .value;

    if (password !== confirmPassword) {

        showAlert(
            "registerAlert",
            "Passwords do not match.",
            "danger"
        );

        return;
    }

    if (password.length < 8) {

        showAlert(
            "registerAlert",
            "Password must contain at least 8 characters.",
            "danger"
        );

        return;
    }

    const formData = new FormData(form);

    // Keep password_confirm: Django serializer requires it.

    setButtonLoading(
        "registerButton",
        "registerButtonText",
        "registerSpinner",
        true,
        "Creating Account..."
    );

    try {

        const response = await apiRequest(

            AUTH_API.register,
            {
                method: "POST",
                auth: false,
                body: formData
            }
        );


        showAlert(
            "registerAlert",
            "Account created successfully. Please login.",
            "success"
        );

        setTimeout(() => {
            window.location.href = "/login/";
        }, 1200);

    } catch (error) {

        console.error("Registration error:", error);

        showAlert(
            "registerAlert",
            getApiErrorMessage(error),
            "danger"
        );

    } finally {

        setButtonLoading(
            "registerButton",
            "registerButtonText",
            "registerSpinner",
            false
        );
    }
}


/* =========================================================
   FORGOT PASSWORD
========================================================= */

function initializeForgotPassword() {

    const form = document.getElementById("forgotPasswordForm");

    if (!form) {
        return;
    }

    form.addEventListener("submit", async event => {

        event.preventDefault();

        hideAlert("forgotAlert");

        if (!form.checkValidity()) {
            form.classList.add("was-validated");
            return;
        }

        const email = document
            .getElementById("forgotEmail")
            .value.trim();

        setButtonLoading(
            "forgotButton",
            "forgotButtonText",
            "forgotSpinner",
            true,
            "Sending..."
        );

        try {

            await apiRequest(
                AUTH_API.passwordReset,
                {
                    method: "POST",
                    auth: false,
                    body: JSON.stringify({ email: email })
                }
            );

            showAlert(
                "forgotAlert",
                "If an account exists with this email, password reset instructions have been sent.",
                "success"
            );

            form.reset();

        } catch (error) {

            console.error("Password reset error:", error);

            showAlert(
                "forgotAlert",
                "If an account exists with this email, password reset instructions have been sent.",
                "success"
            );

        } finally {

            setButtonLoading(
                "forgotButton",
                "forgotButtonText",
                "forgotSpinner",
                false
            );
        }
    });
}


/* =========================================================
   LOGOUT
========================================================= */

async function logoutUser() {

    const refreshToken = TokenManager.getRefreshToken();

    try {

        if (refreshToken) {

            await apiRequest(
                AUTH_API.logout,
                {
                    method: "POST",
                    body: JSON.stringify({
                        refresh: refreshToken
                    })
                }
            );
        }

    } catch (error) {

        console.warn("Logout API error:", error);

    } finally {

        TokenManager.clear();

        window.location.href = "/login/";
    }
}


/* =========================================================
   AUTHENTICATED REQUEST
========================================================= */

async function authenticatedRequest(url, options = {}) {

    return apiRequest(url, options);
}


/* =========================================================
   AUTO INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    initializeLogin();
    initializeRegister();
    initializeForgotPassword();

});
