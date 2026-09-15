console.log('Auth JS loaded');

/**
 * FoodShare Authentication
 *
 * Handles:
 * - Login
 * - Registration
 * - Forgot Password
 * - JWT token storage
 * - Form validation
 * - Password visibility
 * - Password strength
 * - Profile image preview
 */

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

    getStorage() {
        const remember = localStorage.getItem("remember_me");

        return remember === "true"
            ? localStorage
            : sessionStorage;
    },

    save(accessToken, refreshToken, remember = false) {

        localStorage.setItem(
            "remember_me",
            remember ? "true" : "false"
        );

        const storage = remember
            ? localStorage
            : sessionStorage;

        storage.setItem("access_token", accessToken);

        if (refreshToken) {
            storage.setItem("refresh_token", refreshToken);
        }
    },

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

    clear() {

        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("remember_me");

        sessionStorage.removeItem("access_token");
        sessionStorage.removeItem("refresh_token");
    },

    isAuthenticated() {

        return Boolean(this.getAccessToken());
    }
};


/* =========================================================
   API REQUEST HELPER
========================================================= */

async function apiRequest(
    url,
    options = {}
) {

    const token = TokenManager.getAccessToken();

    const headers = {
        "Accept": "application/json",
        ...options.headers
    };

    /*
     * Do not manually set Content-Type when
     * sending FormData.
     */
    if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
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

    if (error.data) {

        const data = error.data;

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
            }

        });

        if (messages.length > 0) {
            return messages.join("<br>");
        }
    }

    return error.message || "Something went wrong.";
}


/* =========================================================
   ALERT HELPER
========================================================= */

function showAlert(
    elementId,
    message,
    type = "danger"
) {

    const alert = document.getElementById(elementId);

    if (!alert) {
        return;
    }

    alert.className = `alert alert-${type}`;
    alert.innerHTML = message;
    alert.classList.remove("d-none");

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


function hideAlert(elementId) {

    const alert = document.getElementById(elementId);

    if (!alert) {
        return;
    }

    alert.classList.add("d-none");
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

    button.disabled = loading;

    if (text) {
        text.textContent = loading
            ? loadingText
            : text.dataset.originalText || text.textContent;
    }

    if (spinner) {
        spinner.classList.toggle("d-none", !loading);
    }
}


/* =========================================================
   PASSWORD VISIBILITY
========================================================= */

function setupPasswordToggle(
    buttonId,
    inputId
) {

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

    form.addEventListener("submit", async event => {

        event.preventDefault();

        hideAlert("loginAlert");

        if (!form.checkValidity()) {

            form.classList.add("was-validated");

            return;
        }

        const email =
            document.getElementById("loginEmail").value.trim();

        const password =
            document.getElementById("loginPassword").value;

        const remember =
            document.getElementById("rememberMe").checked;

        setButtonLoading(
            "loginButton",
            "loginButtonText",
            "loginSpinner",
            true,
            "Signing In..."
        );

        try {

            const data = await apiRequest(
                AUTH_API.login,
                {
                    method: "POST",
                    body: JSON.stringify({
                        email: email,
                        password: password
                    })
                }
            );

            const accessToken =
                data.access ||
                data.access_token ||
                data.token;

            const refreshToken =
                data.refresh ||
                data.refresh_token;

            if (!accessToken) {

                throw new Error(
                    "Login succeeded but no access token was returned."
                );
            }

            TokenManager.save(
                accessToken,
                refreshToken,
                remember
            );

            /*
             * Fetch current user so we can determine
             * the correct dashboard.
             */
            let user = null;

            try {
                user = await apiRequest(AUTH_API.me);
            } catch (error) {
                console.warn(
                    "Unable to fetch user profile:",
                    error
                );
            }

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
   ROLE REDIRECTION
========================================================= */

function redirectAfterLogin(user) {

    if (!user) {

        window.location.href = "/";

        return;
    }

    const role =
        String(
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

        window.location.href = "/admin/dashboard/";

        return;
    }

    if (role === "DONOR") {

        window.location.href = "/donor/dashboard/";

        return;
    }

    if (role === "RECEIVER") {

        window.location.href = "/receiver/dashboard/";

        return;
    }

    window.location.href = "/";
}


/* =========================================================
   REGISTER
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


    /* -----------------------------------------
       Role Selection
    ----------------------------------------- */

    const roleCards = document.querySelectorAll(".role-card");

    roleCards.forEach(card => {

        card.addEventListener("click", () => {

            roleCards.forEach(item => {
                item.classList.remove("active");
            });

            card.classList.add("active");

            const radio =
                card.querySelector('input[type="radio"]');

            if (radio) {
                radio.checked = true;
            }
        });
    });


    /* -----------------------------------------
       Password Strength
    ----------------------------------------- */

    const password =
        document.getElementById("registerPassword");

    if (password) {

        password.addEventListener(
            "input",
            updatePasswordStrength
        );
    }


    /* -----------------------------------------
       Password Match
    ----------------------------------------- */

    const confirmPassword =
        document.getElementById("confirmPassword");

    if (confirmPassword) {

        confirmPassword.addEventListener(
            "input",
            checkPasswordMatch
        );
    }


    /* -----------------------------------------
       Image Preview
    ----------------------------------------- */

    const profileImage =
        document.getElementById("profileImage");

    if (profileImage) {

        profileImage.addEventListener(
            "change",
            previewProfileImage
        );
    }


    /* -----------------------------------------
       Submit
    ----------------------------------------- */

    form.addEventListener(
        "submit",
        handleRegister
    );
}


/* =========================================================
   PASSWORD STRENGTH
========================================================= */

function updatePasswordStrength() {

    const password =
        document.getElementById("registerPassword");

    const bar =
        document.getElementById("passwordStrengthBar");

    const text =
        document.getElementById("passwordStrengthText");

    if (!password || !bar || !text) {
        return;
    }

    const value = password.value;

    let score = 0;

    if (value.length >= 8) {
        score++;
    }

    if (/[A-Z]/.test(value)) {
        score++;
    }

    if (/[a-z]/.test(value)) {
        score++;
    }

    if (/[0-9]/.test(value)) {
        score++;
    }

    if (/[^A-Za-z0-9]/.test(value)) {
        score++;
    }

    const percentage =
        Math.min(score / 5 * 100, 100);

    bar.style.width = `${percentage}%`;

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

    const password =
        document.getElementById("registerPassword");

    const confirm =
        document.getElementById("confirmPassword");

    const message =
        document.getElementById("passwordMatchMessage");

    if (!password || !confirm || !message) {
        return;
    }

    if (!confirm.value) {

        message.textContent = "";

        return;
    }

    if (password.value === confirm.value) {

        message.textContent = "Passwords match.";
        message.className =
            "small mt-1 text-success";

        confirm.classList.remove("is-invalid");
        confirm.classList.add("is-valid");

    } else {

        message.textContent =
            "Passwords do not match.";

        message.className =
            "small mt-1 text-danger";

        confirm.classList.remove("is-valid");
        confirm.classList.add("is-invalid");
    }
}


/* =========================================================
   PROFILE IMAGE PREVIEW
========================================================= */

function previewProfileImage(event) {

    const file = event.target.files[0];

    const preview =
        document.getElementById("profilePreview");

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

    const maxSize =
        5 * 1024 * 1024;

    if (file.size > maxSize) {

        event.target.value = "";

        showAlert(
            "registerAlert",
            "Profile image must be smaller than 5 MB.",
            "danger"
        );

        return;
    }

    const reader =
        new FileReader();

    reader.onload = function(e) {

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

    const password =
        document.getElementById("registerPassword").value;

    const confirmPassword =
        document.getElementById("confirmPassword").value;

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


    const formData =
        new FormData(form);

    /*
     * password_confirm is generally frontend-only.
     * Remove it unless your serializer explicitly expects it.
     */
    formData.delete("password_confirm");


    setButtonLoading(
        "registerButton",
        "registerButtonText",
        "registerSpinner",
        true,
        "Creating Account..."
    );


    try {

        const data = await apiRequest(
            AUTH_API.register,
            {
                method: "POST",
                body: formData
            }
        );

        /*
         * Some APIs automatically login after registration.
         */
        const accessToken =
            data.access ||
            data.access_token ||
            data.token;

        const refreshToken =
            data.refresh ||
            data.refresh_token;

        if (accessToken) {

            TokenManager.save(
                accessToken,
                refreshToken,
                true
            );

            showAlert(
                "registerAlert",
                "Account created successfully. Redirecting...",
                "success"
            );

            setTimeout(() => {

                redirectAfterLogin(data.user || data);

            }, 800);

        } else {

            showAlert(
                "registerAlert",
                "Account created successfully. Please login.",
                "success"
            );

            setTimeout(() => {

                window.location.href = "/login/";

            }, 1200);
        }


    } catch (error) {

        console.error(
            "Registration error:",
            error
        );

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

    const form =
        document.getElementById(
            "forgotPasswordForm"
        );

    if (!form) {
        return;
    }

    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            hideAlert("forgotAlert");

            if (!form.checkValidity()) {

                form.classList.add(
                    "was-validated"
                );

                return;
            }

            const email =
                document.getElementById(
                    "forgotEmail"
                ).value.trim();


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
                        body: JSON.stringify({
                            email: email
                        })
                    }
                );

                showAlert(
                    "forgotAlert",
                    "If an account exists with this email, password reset instructions have been sent.",
                    "success"
                );

                form.reset();


            } catch (error) {

                console.error(
                    "Password reset error:",
                    error
                );

                /*
                 * Don't reveal whether an email exists.
                 * In production, the backend should ideally
                 * return the same response for both cases.
                 */
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
        }
    );
}


/* =========================================================
   LOGOUT
========================================================= */

async function logoutUser() {

    const refreshToken =
        TokenManager.getRefreshToken();

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

        console.warn(
            "Logout API error:",
            error
        );

    } finally {

        TokenManager.clear();

        window.location.href = "/login/";
    }
}


/* =========================================================
   AUTHENTICATED REQUEST
========================================================= */

async function authenticatedRequest(
    url,
    options = {}
) {

    return apiRequest(
        url,
        options
    );
}


/* =========================================================
   AUTO INITIALIZATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeLogin();

        initializeRegister();

        initializeForgotPassword();

    }
);