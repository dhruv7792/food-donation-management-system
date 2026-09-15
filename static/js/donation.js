console.log('Donation JS loaded');

/* =========================================================
   DONATION MANAGEMENT
   donation.js
   ========================================================= */

"use strict";


/* =========================================================
   DONATION CREATE
   ========================================================= */

async function createDonation(event) {

    event.preventDefault();


    const form =
        event.target;

    const submitButton =
        form.querySelector(
            'button[type="submit"]'
        );


    const formData =
        new FormData(form);


    try {

        setButtonLoading(
            submitButton,
            true,
            "Creating..."
        );


        const data =
            await apiRequest(
                "/donations/",
                {
                    method: "POST",
                    body: formData
                }
            );


        showMessage(
            "Donation created successfully!",
            "success",
            "donationMessage"
        );


        form.reset();


        const preview =
            document.getElementById(
                "imagePreview"
            );

        if (preview) {
            preview.innerHTML = "";
        }


        /*
         * Redirect after creation.
         */

        setTimeout(
            function () {

                window.location.href =
                    "/donor/donations/";

            },
            1000
        );


        return data;

    } catch (error) {

        showMessage(
            error.message ||
            "Unable to create donation.",
            "danger",
            "donationMessage"
        );

    } finally {

        setButtonLoading(
            submitButton,
            false
        );
    }
}


/* =========================================================
   LOAD DONATIONS
   ========================================================= */

let donationCurrentPage = 1;


async function loadDonations(page = 1) {

    const table =
        document.getElementById(
            "donationsTable"
        );


    if (!table) {
        return;
    }


    try {

        table.innerHTML = `
            <tr>
                <td colspan="8"
                    class="text-center py-4">

                    <div class="spinner-border
                                text-success">
                    </div>

                    <p class="mt-2 mb-0">
                        Loading donations...
                    </p>

                </td>
            </tr>
        `;


        const search =
            document.getElementById(
                "donationSearch"
            )?.value || "";


        const category =
            document.getElementById(
                "donationCategory"
            )?.value || "";


        const status =
            document.getElementById(
                "donationStatus"
            )?.value || "";


        const params =
            new URLSearchParams();


        params.set("page", page);


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


        const data =
            await apiRequest(
                `/donations/?${params.toString()}`
            );


        renderDonationTable(data);


        donationCurrentPage =
            page;


        updateDonationPagination(
            data
        );

    } catch (error) {

        table.innerHTML = `
            <tr>
                <td colspan="8"
                    class="text-center text-danger py-4">

                    Unable to load donations.

                </td>
            </tr>
        `;

        showMessage(
            error.message,
            "danger"
        );
    }
}


/* =========================================================
   RENDER DONATION TABLE
   ========================================================= */

function renderDonationTable(data) {

    const table =
        document.getElementById(
            "donationsTable"
        );


    if (!table) {
        return;
    }


    const donations =
        Array.isArray(data)
            ? data
            : data.results || [];


    if (donations.length === 0) {

        table.innerHTML = `
            <tr>
                <td colspan="8"
                    class="text-center
                           text-muted py-5">

                    No donations found.

                </td>
            </tr>
        `;

        return;
    }


    table.innerHTML =
        donations.map(
            donation => `

            <tr>

                <td>
                    ${
                        donation.image
                        ?
                        `<img src="${escapeHTML(donation.image)}"
                              width="60"
                              height="60"
                              class="rounded object-fit-cover"
                              alt="Food">`
                        :
                        `<div class="bg-light
                                    rounded
                                    d-flex
                                    align-items-center
                                    justify-content-center"
                              style="width:60px;height:60px;">
                            <i class="bi bi-image"></i>
                         </div>`
                    }
                </td>


                <td>
                    <strong>
                        ${escapeHTML(
                            donation.food_name ||
                            donation.title ||
                            "-"
                        )}
                    </strong>
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

                    <a href="/donor/donations/${donation.id}/"
                       class="btn btn-sm btn-outline-primary">

                        <i class="bi bi-eye"></i>

                    </a>


                    <button
                        class="btn btn-sm btn-outline-danger"
                        onclick="deleteDonation(${donation.id})">

                        <i class="bi bi-trash"></i>

                    </button>

                </td>

            </tr>
        `
        ).join("");
}


/* =========================================================
   PAGINATION
   ========================================================= */

function updateDonationPagination(data) {

    const pagination =
        document.getElementById(
            "donationsPagination"
        );


    if (!pagination) {
        return;
    }


    if (
        !data ||
        Array.isArray(data)
    ) {

        pagination.innerHTML = "";

        return;
    }


    const count =
        data.count || 0;


    const pageSize =
        data.results?.length || 10;


    const totalPages =
        Math.ceil(
            count / pageSize
        );


    renderPagination(
        "donationsPagination",
        donationCurrentPage,
        totalPages,
        "loadDonations"
    );
}


/* =========================================================
   DELETE DONATION
   ========================================================= */

async function deleteDonation(
    donationId
) {

    if (
        !confirmAction(
            "Are you sure you want to delete this donation?"
        )
    ) {
        return;
    }


    try {

        await apiRequest(
            `/donations/${donationId}/`,
            {
                method: "DELETE"
            }
        );


        showMessage(
            "Donation deleted successfully.",
            "success"
        );


        loadDonations(
            donationCurrentPage
        );

    } catch (error) {

        showMessage(
            error.message ||
            "Unable to delete donation.",
            "danger"
        );
    }
}


/* =========================================================
   DONATION DETAILS
   ========================================================= */

async function loadDonationDetail(
    donationId
) {

    try {

        const data =
            await apiRequest(
                `/donations/${donationId}/`
            );


        const elements = {

            name:
                document.getElementById(
                    "detailFoodName"
                ),

            category:
                document.getElementById(
                    "detailCategory"
                ),

            quantity:
                document.getElementById(
                    "detailQuantity"
                ),

            status:
                document.getElementById(
                    "detailStatus"
                ),

            description:
                document.getElementById(
                    "detailDescription"
                ),

            expiry:
                document.getElementById(
                    "detailExpiry"
                )
        };


        if (elements.name) {

            elements.name.textContent =
                data.food_name ||
                data.title ||
                "-";
        }


        if (elements.category) {

            elements.category.textContent =
                data.category ||
                "-";
        }


        if (elements.quantity) {

            elements.quantity.textContent =
                data.quantity ||
                "-";
        }


        if (elements.status) {

            elements.status.innerHTML =
                statusBadge(
                    data.status
                );
        }


        if (elements.description) {

            elements.description.textContent =
                data.description ||
                "No description available.";
        }


        if (elements.expiry) {

            elements.expiry.textContent =
                formatDate(
                    data.expiry_date
                );
        }


        return data;

    } catch (error) {

        showMessage(
            error.message,
            "danger"
        );
    }
}


/* =========================================================
   FILTER EVENTS
   ========================================================= */

function initializeDonationList() {

    const search =
        document.getElementById(
            "donationSearch"
        );


    const category =
        document.getElementById(
            "donationCategory"
        );


    const status =
        document.getElementById(
            "donationStatus"
        );


    if (search) {

        let timeout;


        search.addEventListener(
            "input",
            function () {

                clearTimeout(timeout);


                timeout =
                    setTimeout(
                        () => loadDonations(1),
                        400
                    );
            }
        );
    }


    [category, status]
        .filter(Boolean)
        .forEach(
            element => {

                element.addEventListener(
                    "change",
                    () => loadDonations(1)
                );
            }
        );


    loadDonations(1);
}


/* =========================================================
   IMAGE PREVIEW + FORM
   ========================================================= */

function initializeDonationCreate() {

    const form =
        document.getElementById(
            "donationForm"
        );


    if (form) {

        form.addEventListener(
            "submit",
            createDonation
        );
    }


    setupImagePreview(
        "id_image",
        "imagePreview"
    );
}


/* =========================================================
   DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        if (
            document.getElementById(
                "donationForm"
            )
        ) {

            initializeDonationCreate();
        }


        if (
            document.getElementById(
                "donationsTable"
            )
        ) {

            initializeDonationList();
        }

    }
);