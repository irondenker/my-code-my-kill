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
    if (window.__XSS_CLIENT_SIDE_SANITIZE_ENABLED__) {
        return;
    }

    function escapeRegExp(input) {
        return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function normalizeClientSideOptions(rawOptions) {
        const options = rawOptions && typeof rawOptions === "object" ? rawOptions : {};
        const rawToggles =
            options.defaultRuleToggles && typeof options.defaultRuleToggles === "object"
                ? options.defaultRuleToggles
                : {};
        const toggles = {
            ampersand: rawToggles.ampersand !== false,
            lessThan: rawToggles.lessThan !== false,
            greaterThan: rawToggles.greaterThan !== false,
            doubleQuote: rawToggles.doubleQuote !== false,
            singleQuote: rawToggles.singleQuote !== false,
            backtick: rawToggles.backtick !== false,
        };
        const customRules = Array.isArray(options.customRules)
            ? options.customRules.filter((rule) => {
                return (
                    rule &&
                    typeof rule === "object" &&
                    typeof rule.from === "string" &&
                    rule.from.length > 0 &&
                    typeof rule.to === "string"
                );
            })
            : [];

        return { toggles, customRules };
    }

    function createClientSideEscaper(rawOptions) {
        const normalized = normalizeClientSideOptions(rawOptions);
        const rules = [];

        if (normalized.toggles.ampersand) {
            rules.push({ from: "&", to: "&amp;" });
        }
        if (normalized.toggles.lessThan) {
            rules.push({ from: "<", to: "&lt;" });
        }
        if (normalized.toggles.greaterThan) {
            rules.push({ from: ">", to: "&gt;" });
        }
        if (normalized.toggles.doubleQuote) {
            rules.push({ from: "\"", to: "&quot;" });
        }
        if (normalized.toggles.singleQuote) {
            rules.push({ from: "'", to: "&#39;" });
        }
        if (normalized.toggles.backtick) {
            rules.push({ from: "`", to: "&#96;" });
        }

        normalized.customRules.forEach((rule) => {
            const existingIndex = rules.findIndex((candidate) => candidate.from === rule.from);
            if (existingIndex >= 0) {
                rules.splice(existingIndex, 1);
            }
            rules.push({
                from: rule.from,
                to: rule.to,
            });
        });

        rules.sort((left, right) => right.from.length - left.from.length);

        if (rules.length === 0) {
            return (value) => {
                if (value === null || typeof value === "undefined") {
                    return "";
                }
                return String(value);
            };
        }

        const replacementMap = new Map(rules.map((rule) => [rule.from, rule.to]));
        const pattern = new RegExp(rules.map((rule) => escapeRegExp(rule.from)).join("|"), "g");
        return (value) => {
            if (value === null || typeof value === "undefined") {
                return "";
            }
            return String(value).replace(pattern, (matched) => {
                return replacementMap.get(matched) ?? matched;
            });
        };
    }

    const escapeForClientSide = createClientSideEscaper(window.__XSS_CLIENT_SIDE_OPTIONS__);

    function sanitizeDataAttributes(element, attributes) {
        attributes.forEach((attributeName) => {
            const value = element.getAttribute(attributeName);
            if (typeof value !== "string" || value.length === 0) {
                return;
            }
            element.setAttribute(attributeName, escapeForClientSide(value));
        });
    }

    function enable() {
        const bootstrapApi = window.bootstrap;
        if (!bootstrapApi) {
            return;
        }

        if (bootstrapApi.Tooltip) {
            document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((element) => {
                sanitizeDataAttributes(element, ["title", "data-bs-title"]);
                bootstrapApi.Tooltip.getOrCreateInstance(element, {
                    html: true,
                    sanitize: false,
                });
            });
        }

        if (bootstrapApi.Popover) {
            document.querySelectorAll('[data-bs-toggle="popover"]').forEach((element) => {
                sanitizeDataAttributes(element, ["title", "data-bs-title", "data-bs-content"]);
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
