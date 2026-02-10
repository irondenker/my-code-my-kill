(function initAutoToasts() {
    function showToasts() {
        const toastElements = document.querySelectorAll('[data-auto-toast="true"]');
        if (!toastElements.length) {
            return;
        }

        const bootstrapApi = window.bootstrap;
        if (!bootstrapApi || !bootstrapApi.Toast) {
            return;
        }

        toastElements.forEach((element) => {
            const toast = bootstrapApi.Toast.getOrCreateInstance(element, {
                autohide: true,
            });
            toast.show();
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", showToasts, { once: true });
        return;
    }

    showToasts();
})();

(function initUnsafeBootstrapForLab() {
    if (!window.__LAB_STORED_XSS__) {
        return;
    }

    function enable() {
        const bootstrapApi = window.bootstrap;
        if (!bootstrapApi) {
            return;
        }

        if (bootstrapApi.Tooltip) {
            document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((element) => {
                bootstrapApi.Tooltip.getOrCreateInstance(element, {
                    html: true,
                    sanitize: false,
                });
            });
        }

        if (bootstrapApi.Popover) {
            document.querySelectorAll('[data-bs-toggle="popover"]').forEach((element) => {
                bootstrapApi.Popover.getOrCreateInstance(element, {
                    html: true,
                    sanitize: false,
                });
            });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", enable, { once: true });
        return;
    }

    enable();
})();
