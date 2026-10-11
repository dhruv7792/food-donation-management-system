/*
 * FoodShare - Authentication JavaScript
 *
 * Handles:
 * 1. Registration
 * 2. Login
 * 3. Password show/hide
 * 4. Password strength
 * 5. Password match
 * 6. Role selection
 * 7. Profile image preview
 */

document.addEventListener("DOMContentLoaded", function () {

    // =========================================================
    // COMMON HELPERS
    // =========================================================

    function showMessage(element, message, type = "danger") {
        if (!element) return;

        element.className = `alert alert-${type}`;
        element.textContent = message;
        element.classList.remove("d-none");
    }

    function hideMessage(element) {
        if (!element) return;

        element.className = "alert d-none";
        element.textContent = "";
    }

    function formatErrors(result) {
        if (!result) {
            return "Something went wrong.";
        }

        if (typeof result === "string") {
            return result;
        }

        if (result.message && !result.errors) {
            return result.message;
        }

        const errors = result.errors || result;
        const messages = [];

        Object.keys(errors).forEach(function (field) {
            let value = errors[field];

            if (Array.isArray(value)) {
                value = value.join(", ");
            } else if (typeof value === "object" && value !== null) {
                value = JSON.stringify(value);
            }

            messages.push(`${field}: ${value}`);
        });

        return messages.length
            ? messages.join(" | ")
            : (result.message || "Request failed.");
    }


    // =========================================================
    // REGISTER PAGE
    // =========================================================

    const registerForm = document.getElementById("registerForm");

    if (registerForm) {

        const registerAlert =
            document.getElementById("registerAlert");

        const registerButton =
            document.getElementById("registerButton");

        const registerButtonText =
            document.getElementById("registerButtonText");

        const registerSpinner =
            document.getElementById("registerSpinner");

        const donorRoleCard =
            document.getElementById("donorRoleCard");

        const receiverRoleCard =
            document.getElementById("receiverRoleCard");

        const roleInputs =
            document.querySelectorAll('input[name="role"]');

        const passwordInput =
            document.getElementById("registerPassword");

        const confirmPasswordInput =
            document.getElementById("confirmPassword");

        const togglePassword =
            document.getElementById("toggleRegisterPassword");

        const toggleConfirmPassword =
            document.getElementById("toggleConfirmPassword");

        const passwordStrengthBar =
            document.getElementById("passwordStrengthBar");

        const passwordStrengthText =
            document.getElementById("passwordStrengthText");

        const passwordMatchMessage =
            document.getElementById("passwordMatchMessage");

        const profileImage =
            document.getElementById("profileImage");

        const profilePreview =
            document.getElementById("profilePreview");


        // =====================================================
        // ROLE SELECTION
        // =====================================================

        roleInputs.forEach(function (input) {

            input.addEventListener("change", function () {

                if (this.value === "DONOR") {

                    if (donorRoleCard) {
                        donorRoleCard.classList.add("active");
                    }

                    if (receiverRoleCard) {
                        receiverRoleCard.classList.remove("active");
                    }

                } else {

                    if (receiverRoleCard) {
                        receiverRoleCard.classList.add("active");
                    }

                    if (donorRoleCard) {
                        donorRoleCard.classList.remove("active");
                    }
                }
            });
        });


        // =====================================================
        // PASSWORD SHOW / HIDE
        // =====================================================

        function setupPasswordToggle(button, input) {

            if (!button || !input) {
                return;
            }

            button.addEventListener("click", function () {

                const isVisible =
                    input.type === "text";

                input.type =
                    isVisible ? "password" : "text";

                this.innerHTML = isVisible
                    ? '<i class="bi bi-eye"></i>'
                    : '<i class="bi bi-eye-slash"></i>';

                this.setAttribute(
                    "aria-label",
                    isVisible
                        ? "Show password"
                        : "Hide password"
                );
            });
        }

        setupPasswordToggle(
            togglePassword,
            passwordInput
        );

        setupPasswordToggle(
            toggleConfirmPassword,
            confirmPasswordInput
        );


        // =====================================================
        // PASSWORD STRENGTH
        // =====================================================

        function updatePasswordStrength() {

            if (
                !passwordInput ||
                !passwordStrengthBar ||
                !passwordStrengthText
            ) {
                return;
            }

            const password =
                passwordInput.value;

            let strength = 0;

            if (password.length >= 8) {
                strength++;
            }

            if (/[A-Z]/.test(password)) {
                strength++;
            }

            if (/[a-z]/.test(password)) {
                strength++;
            }

            if (/[0-9]/.test(password)) {
                strength++;
            }

            if (/[^A-Za-z0-9]/.test(password)) {
                strength++;
            }


            if (strength === 0) {

                passwordStrengthBar.style.width =
                    "0%";

                passwordStrengthText.textContent =
                    "Minimum 8 characters";

            } else if (strength <= 2) {

                passwordStrengthBar.style.width =
                    "40%";

                passwordStrengthText.textContent =
                    "Weak password";

            } else if (strength === 3) {

                passwordStrengthBar.style.width =
                    "60%";

                passwordStrengthText.textContent =
                    "Medium password";

            } else if (strength === 4) {

                passwordStrengthBar.style.width =
                    "80%";

                passwordStrengthText.textContent =
                    "Strong password";

            } else {

                passwordStrengthBar.style.width =
                    "100%";

                passwordStrengthText.textContent =
                    "Very strong password";
            }
        }

        if (passwordInput) {
            passwordInput.addEventListener(
                "input",
                updatePasswordStrength
            );
        }


        // =====================================================
        // PASSWORD MATCH
        // =====================================================

        function checkPasswordMatch() {

            if (
                !passwordInput ||
                !confirmPasswordInput ||
                !passwordMatchMessage
            ) {
                return;
            }

            const password =
                passwordInput.value;

            const confirmPassword =
                confirmPasswordInput.value;


            if (!confirmPassword) {

                passwordMatchMessage.textContent =
                    "";

                passwordMatchMessage.className =
                    "small mt-1";

                return;
            }


            if (password === confirmPassword) {

                passwordMatchMessage.textContent =
                    "Passwords match.";

                passwordMatchMessage.className =
                    "small mt-1 text-success";

            } else {

                passwordMatchMessage.textContent =
                    "Passwords do not match.";

                passwordMatchMessage.className =
                    "small mt-1 text-danger";
            }
        }

        if (passwordInput) {
            passwordInput.addEventListener(
                "input",
                checkPasswordMatch
            );
        }

        if (confirmPasswordInput) {
            confirmPasswordInput.addEventListener(
                "input",
                checkPasswordMatch
            );
        }


        // =====================================================
        // PROFILE IMAGE PREVIEW
        // =====================================================

        if (profileImage && profilePreview) {

            profileImage.addEventListener(
                "change",
                function () {

                    const file =
                        this.files[0];

                    if (!file) {

                        profilePreview.src = "";
                        profilePreview.style.display =
                            "none";

                        return;
                    }


                    const reader =
                        new FileReader();

                    reader.onload =
                        function (event) {

                            profilePreview.src =
                                event.target.result;

                            profilePreview.style.display =
                                "block";
                        };

                    reader.readAsDataURL(file);
                }
            );
        }


        // =====================================================
        // REGISTRATION SUBMIT
        // =====================================================

        registerForm.addEventListener(
            "submit",
            async function (event) {

                // VERY IMPORTANT:
                // Prevent normal POST /register/
                event.preventDefault();
                event.stopPropagation();

                hideMessage(registerAlert);


                // -------------------------------------------------
                // GET FORM VALUES
                // -------------------------------------------------

                const firstName =
                    document.getElementById("firstName")
                        ?.value.trim() || "";

                const lastName =
                    document.getElementById("lastName")
                        ?.value.trim() || "";

                const email =
                    document.getElementById("registerEmail")
                        ?.value.trim()
                        .toLowerCase() || "";

                const phone =
                    document.getElementById("phoneNumber")
                        ?.value.trim() || "";

                const address =
                    document.getElementById("address")
                        ?.value.trim() || "";

                const password =
                    passwordInput?.value || "";

                const passwordConfirm =
                    confirmPasswordInput?.value || "";

                const role =
                    document.querySelector(
                        'input[name="role"]:checked'
                    )?.value || "DONOR";

                const terms =
                    document.getElementById("terms")
                        ?.checked || false;


                // -------------------------------------------------
                // VALIDATION
                // -------------------------------------------------

                if (!firstName) {

                    showMessage(
                        registerAlert,
                        "First name is required."
                    );

                    return;
                }


                if (!lastName) {

                    showMessage(
                        registerAlert,
                        "Last name is required."
                    );

                    return;
                }


                if (!email) {

                    showMessage(
                        registerAlert,
                        "Email is required."
                    );

                    return;
                }


                if (
                    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
                        .test(email)
                ) {

                    showMessage(
                        registerAlert,
                        "Please enter a valid email address."
                    );

                    return;
                }


                if (!phone) {

                    showMessage(
                        registerAlert,
                        "Phone number is required."
                    );

                    return;
                }


                if (!address) {

                    showMessage(
                        registerAlert,
                        "Address is required."
                    );

                    return;
                }


                if (password.length < 8) {

                    showMessage(
                        registerAlert,
                        "Password must contain at least 8 characters."
                    );

                    return;
                }


                if (password !== passwordConfirm) {

                    showMessage(
                        registerAlert,
                        "Passwords do not match."
                    );

                    return;
                }


                if (!terms) {

                    showMessage(
                        registerAlert,
                        "Please accept the Terms & Conditions."
                    );

                    return;
                }


                // -------------------------------------------------
                // CREATE USERNAME
                // -------------------------------------------------

                const username =
                    email
                        .split("@")[0]
                        .toLowerCase()
                        .replace(
                            /[^a-z0-9_]/g,
                            ""
                        );


                if (!username) {

                    showMessage(
                        registerAlert,
                        "Unable to create username from email."
                    );

                    return;
                }


                // -------------------------------------------------
                // API DATA
                // -------------------------------------------------

                const data = {

                    username: username,

                    email: email,

                    password: password,

                    password_confirm:
                        passwordConfirm,

                    first_name:
                        firstName,

                    last_name:
                        lastName,

                    phone:
                        phone,

                    address:
                        address,

                    role:
                        role
                };


                console.log(
                    "Registration request started"
                );


                // -------------------------------------------------
                // LOADING STATE
                // -------------------------------------------------

                if (registerButton) {
                    registerButton.disabled = true;
                }

                if (registerButtonText) {

                    registerButtonText.textContent =
                        "Creating Account...";
                }

                if (registerSpinner) {

                    registerSpinner.classList.remove(
                        "d-none"
                    );
                }


                try {

                    // -------------------------------------------------
                    // SEND TO DJANGO API
                    // -------------------------------------------------

                    const response =
                        await fetch(
                            "/api/v1/auth/register/",
                            {
                                method: "POST",

                                headers: {
                                    "Content-Type":
                                        "application/json",

                                    "Accept":
                                        "application/json"
                                },

                                body:
                                    JSON.stringify(data)
                            }
                        );


                    const result =
                        await response.json();


                    console.log(
                        "Registration status:",
                        response.status
                    );

                    console.log(
                        "Registration response:",
                        result
                    );


                    // -------------------------------------------------
                    // SUCCESS
                    // -------------------------------------------------

                    if (
                        response.ok &&
                        result.success !== false
                    ) {

                        showMessage(
                            registerAlert,

                            result.message ||
                            "Registration successful! Redirecting to login...",

                            "success"
                        );


                        console.log(
                            "Registration successful."
                        );


                        // Redirect to login
                        setTimeout(
                            function () {

                                window.location.replace(
                                    "/login/"
                                );

                            },
                            1000
                        );


                        return;
                    }


                    // -------------------------------------------------
                    // BACKEND ERROR
                    // -------------------------------------------------

                    showMessage(
                        registerAlert,
                        formatErrors(result),
                        "danger"
                    );


                } catch (error) {

                    console.error(
                        "Registration error:",
                        error
                    );


                    showMessage(
                        registerAlert,

                        "Unable to connect to the server. Please make sure Django is running.",

                        "danger"
                    );


                } finally {

                    if (registerButton) {

                        registerButton.disabled =
                            false;
                    }

                    if (registerButtonText) {

                        registerButtonText.textContent =
                            "Create Account";
                    }

                    if (registerSpinner) {

                        registerSpinner.classList.add(
                            "d-none"
                        );
                    }
                }
            }
        );
    }


    // =========================================================
    // LOGIN PAGE
    // =========================================================

    const loginForm =
        document.getElementById("loginForm");


    if (loginForm) {

        const loginAlert =
            document.getElementById("loginAlert");

        const loginButton =
            document.getElementById("loginButton");

        const emailInput =
            document.getElementById("loginEmail");

        const passwordInput =
            document.getElementById("loginPassword");

        const showPassword =
            document.getElementById("showPassword");


        // -----------------------------------------------------
        // LOGIN SUBMIT
        // -----------------------------------------------------

        loginForm.addEventListener(
            "submit",
            async function (event) {

                // Prevent normal POST /login/
                event.preventDefault();
                event.stopPropagation();

                hideMessage(loginAlert);


                const email =
                    emailInput?.value
                        .trim()
                        .toLowerCase() || "";

                const password =
                    passwordInput?.value || "";


                if (!email || !password) {

                    showMessage(
                        loginAlert,
                        "Please enter email and password.",
                        "warning"
                    );

                    return;
                }


                if (loginButton) {

                    loginButton.disabled = true;

                    loginButton.textContent =
                        "Signing in...";
                }


                try {

                    console.log(
                        "Sending login request..."
                    );


                    const response =
                        await fetch(
                            "/api/v1/auth/login/",
                            {
                                method: "POST",

                                headers: {
                                    "Content-Type":
                                        "application/json",

                                    "Accept":
                                        "application/json"
                                },

                                body:
                                    JSON.stringify({
                                        email: email,
                                        password: password
                                    })
                            }
                        );


                    const result =
                        await response.json();


                    console.log(
                        "Login status:",
                        response.status
                    );

                    console.log(
                        "Login response:",
                        result
                    );


                    // -------------------------------------------------
                    // LOGIN SUCCESS
                    // -------------------------------------------------

                    if (
                        response.ok &&
                        result.success
                    ) {

                        localStorage.setItem(
                            "access_token",
                            result.data.access
                        );

                        localStorage.setItem(
                            "refresh_token",
                            result.data.refresh
                        );

                        localStorage.setItem(
                            "user",
                            JSON.stringify(
                                result.data.user
                            )
                        );


                        showMessage(
                            loginAlert,
                            "Login successful! Redirecting...",
                            "success"
                        );


                        const role =
                            result.data.user.role;


                        setTimeout(
                            function () {

                                if (
                                    role === "DONOR"
                                ) {

                                    window.location.replace(
                                        "/donor/"
                                    );

                                } else if (
                                    role === "RECEIVER"
                                ) {

                                    window.location.replace(
                                        "/receiver/"
                                    );

                                } else if (
                                    role === "ADMIN"
                                ) {

                                    window.location.replace(
                                        "/management/"
                                    );

                                } else {

                                    window.location.replace(
                                        "/"
                                    );
                                }

                            },
                            500
                        );


                        return;
                    }


                    // -------------------------------------------------
                    // LOGIN ERROR
                    // -------------------------------------------------

                    showMessage(
                        loginAlert,
                        formatErrors(result),
                        "danger"
                    );


                } catch (error) {

                    console.error(
                        "Login error:",
                        error
                    );


                    showMessage(
                        loginAlert,
                        "Unable to connect to the server.",
                        "danger"
                    );


                } finally {

                    if (loginButton) {

                        loginButton.disabled =
                            false;

                        loginButton.textContent =
                            "Sign In";
                    }
                }
            }
        );


        // -----------------------------------------------------
        // LOGIN PASSWORD SHOW / HIDE
        // -----------------------------------------------------

        if (
            passwordInput &&
            showPassword
        ) {

            showPassword.addEventListener(
                "click",
                function () {

                    const isVisible =
                        passwordInput.type ===
                        "text";


                    passwordInput.type =
                        isVisible
                            ? "password"
                            : "text";


                    this.textContent =
                        isVisible
                            ? "👁"
                            : "🙈";


                    this.setAttribute(
                        "aria-label",
                        isVisible
                            ? "Show password"
                            : "Hide password"
                    );
                }
            );
        }
    }
});