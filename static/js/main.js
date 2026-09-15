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