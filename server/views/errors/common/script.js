const descriptors = {
    "400": {
        kicker: "nginx edge layer",
        title: "BAD REQUEST",
        message: "The request could not be understood by the server.",
        subtitle: "ERR_BAD_REQUEST",
        gimmick: "edge",
        showBadges: true,
    },
    "403": {
        kicker: "application layer",
        title: "FORBIDDEN",
        message: "You do not have permission to access this resource.",
        subtitle: "ERR_FORBIDDEN",
        gimmick: "question",
        showBadges: false,
    },
    "404": {
        kicker: "application layer",
        title: "NOT FOUND",
        message: "The page you requested could not be found. Check the URL and try again.",
        subtitle: "ERR_NOT_FOUND",
        gimmick: "question",
        showBadges: false,
    },
    "405": {
        kicker: "application fallback",
        title: "METHOD NOT ALLOWED",
        message: "This HTTP method is not allowed for the requested resource.",
        subtitle: "ERR_METHOD_NOT_ALLOWED",
        gimmick: "edge",
        showBadges: false,
    },
    "408": {
        kicker: "nginx edge layer",
        title: "REQUEST TIMEOUT",
        message: "The request timed out before the server received the full payload.",
        subtitle: "ERR_REQUEST_TIMEOUT",
        gimmick: "edge",
        showBadges: true,
    },
    "409": {
        kicker: "application fallback",
        title: "CONFLICT",
        message: "The request could not be completed because of a state conflict.",
        subtitle: "ERR_CONFLICT",
        gimmick: "edge",
        showBadges: false,
    },
    "410": {
        kicker: "application fallback",
        title: "RESOURCE GONE",
        message: "The requested resource is no longer available.",
        subtitle: "ERR_GONE",
        gimmick: "edge",
        showBadges: false,
    },
    "413": {
        kicker: "nginx edge layer",
        title: "PAYLOAD TOO LARGE",
        message: "The request body is larger than the allowed upload limit.",
        subtitle: "ERR_CONTENT_TOO_LARGE",
        gimmick: "edge",
        showBadges: true,
    },
    "414": {
        kicker: "nginx edge layer",
        title: "URI TOO LONG",
        message: "The requested URI is too long to be processed.",
        subtitle: "ERR_URI_TOO_LONG",
        gimmick: "edge",
        showBadges: true,
    },
    "422": {
        kicker: "application fallback",
        title: "UNPROCESSABLE REQUEST",
        message: "The request format was valid, but the server could not process the content.",
        subtitle: "ERR_UNPROCESSABLE_ENTITY",
        gimmick: "edge",
        showBadges: false,
    },
    "429": {
        kicker: "nginx edge layer",
        title: "TOO MANY REQUESTS",
        message: "Too many requests were sent in a short period. Try again later.",
        subtitle: "ERR_RATE_LIMITED",
        gimmick: "edge",
        showBadges: true,
    },
    "431": {
        kicker: "nginx edge layer",
        title: "HEADER TOO LARGE",
        message: "Request headers exceed the acceptable size.",
        subtitle: "ERR_REQUEST_HEADER_FIELDS_TOO_LARGE",
        gimmick: "edge",
        showBadges: true,
    },
    "494": {
        kicker: "nginx edge layer",
        title: "INVALID REQUEST HEADER",
        message: "The request was rejected because header data is invalid or too large.",
        subtitle: "ERR_NGINX_494",
        gimmick: "edge",
        showBadges: true,
    },
    "495": {
        kicker: "nginx edge layer",
        title: "TLS CERTIFICATE ERROR",
        message: "The client certificate could not be validated during TLS negotiation.",
        subtitle: "ERR_NGINX_495",
        gimmick: "edge",
        showBadges: true,
    },
    "496": {
        kicker: "nginx edge layer",
        title: "TLS CERTIFICATE REQUIRED",
        message: "A valid client certificate is required to access this endpoint.",
        subtitle: "ERR_NGINX_496",
        gimmick: "edge",
        showBadges: true,
    },
    "500": {
        kicker: "application layer",
        title: "INTERNAL ERROR",
        message: "Something went wrong on our side. Please try again later. If this issue continues, contact the administrator.",
        subtitle: "ERR_INTERNAL_SERVER_ERROR",
        gimmick: "glitch",
        showBadges: false,
    },
    "501": {
        kicker: "application fallback",
        title: "NOT IMPLEMENTED",
        message: "This function is not implemented by the current application path.",
        subtitle: "ERR_NOT_IMPLEMENTED",
        gimmick: "edge",
        showBadges: false,
    },
    "502": {
        kicker: "nginx edge layer",
        title: "BAD GATEWAY",
        message: "The upstream application returned an invalid response.",
        subtitle: "ERR_BAD_GATEWAY",
        gimmick: "edge",
        showBadges: true,
    },
    "503": {
        kicker: "application layer",
        title: "SERVICE UNAVAILABLE",
        message: "The service is temporarily unavailable. Please try again later.",
        subtitle: "ERR_SERVICE_UNAVAILABLE",
        gimmick: "glitch",
        showBadges: false,
    },
    "504": {
        kicker: "application layer",
        title: "GATEWAY TIMEOUT",
        message: "The upstream server took too long to respond. Please try again later.",
        subtitle: "ERR_GATEWAY_TIMEOUT",
        gimmick: "timeout",
        showBadges: false,
    },
};

const defaultNginxDescriptor = {
    kicker: "nginx edge layer",
    title: "REQUEST INTERRUPTED",
    message: "The request could not be completed at the edge or upstream layer.",
    subtitle: "ERR_EDGE_FAILURE",
    gimmick: "edge",
    showBadges: true,
};

const defaultAppDescriptor = {
    kicker: "application fallback",
    title: "REQUEST FAILED",
    message: "The request reached the application, but the response could not be completed.",
    subtitle: "ERR_APPLICATION_FAILURE",
    gimmick: "edge",
    showBadges: false,
};

const edgeKickerNode = document.getElementById("edge-kicker");
const edgeCodeNode = document.getElementById("edge-code");
const edgeTitleNode = document.getElementById("edge-title");
const edgeMessageNode = document.getElementById("edge-message");
const edgeSubtitleNode = document.getElementById("edge-subtitle");

const stackContainer = document.querySelector(".stack-container");
const cardNodes = Array.from(document.querySelectorAll(".card-container"));
const consoleNodes = Array.from(document.querySelectorAll(".writing"));
const perspecNodes = Array.from(document.querySelectorAll(".perspec"));
const firstPerspec = document.querySelector(".perspec");
const firstCard = document.querySelector(".card");
const connectorNode = document.getElementById("server-network-connector");
const errorTagNode = document.getElementById("errorTag");

let remainingCards = stackContainer ? cardNodes.length : 0;

const THROW_VARIANT_CLASSES = ["throw-a", "throw-b", "throw-c", "throw-d", "throw-e", "throw-f"];
const LINE_LENGTH_BUCKETS = [24, 32, 40, 48, 56, 64, 72, 80, 88, 96];

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function normalizeStatus(raw) {
    if (!raw || raw.includes("__")) return null;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isInteger(parsed) || parsed < 400 || parsed > 599) {
        return null;
    }
    return String(parsed);
}

function normalizeSource(raw) {
    if (!raw || raw.includes("__")) return null;
    if (raw === "app" || raw === "app-fallback" || raw === "nginx") return raw;
    return null;
}

function inferStatusFromPathname(pathname) {
    if (!pathname) return null;
    const match = pathname.match(/^\/occur\/(?:nginx|ssr)\/(\d{3})\/?$/);
    if (!match) return null;
    return normalizeStatus(match[1]);
}

function inferSourceFromPathname(pathname) {
    if (!pathname) return null;
    if (/^\/occur\/nginx\/\d{3}\/?$/.test(pathname)) return "nginx";
    if (/^\/occur\/ssr\/\d{3}\/?$/.test(pathname)) return "app";
    return null;
}

function inferStatusFromNavigationTiming() {
    if (!window.performance?.getEntriesByType) return null;
    const entries = window.performance.getEntriesByType("navigation");
    if (!entries || entries.length === 0) return null;

    const responseStatus = entries[0]?.responseStatus;
    if (!Number.isInteger(responseStatus)) return null;
    return normalizeStatus(String(responseStatus));
}

function clearCodeLists() {
    cardNodes.forEach((cardNode) => {
        const list = cardNode.querySelector(".code ul");
        if (list) {
            list.innerHTML = "";
        }
    });
    consoleNodes.forEach((panel) => panel.classList.remove("writing-error"));
}

function setGimmick(mode) {
    document.body.classList.remove("gimmick-question", "gimmick-glitch", "gimmick-timeout", "gimmick-edge");
    document.body.classList.add(`gimmick-${mode}`);
}

function getDescriptor(code, source) {
    const matched = descriptors[code];
    if (matched) return matched;
    return source === "app" || source === "app-fallback" ? defaultAppDescriptor : defaultNginxDescriptor;
}

function applyCodeDescriptor(code, source) {
    const descriptor = getDescriptor(code, source);

    if (edgeKickerNode) edgeKickerNode.textContent = descriptor.kicker;
    if (edgeCodeNode) edgeCodeNode.textContent = code;
    if (edgeTitleNode) edgeTitleNode.textContent = "error";
    if (edgeMessageNode) edgeMessageNode.textContent = descriptor.message;
    if (edgeSubtitleNode) edgeSubtitleNode.textContent = descriptor.subtitle;

    setGimmick(descriptor.gimmick);
    return descriptor.gimmick;
}

function applyFallbackDescriptor(source) {
    const descriptor = source === "app" || source === "app-fallback" ? defaultAppDescriptor : defaultNginxDescriptor;

    if (edgeKickerNode) edgeKickerNode.textContent = descriptor.kicker;
    if (edgeCodeNode) edgeCodeNode.textContent = "4XX / 5XX";
    if (edgeTitleNode) edgeTitleNode.textContent = "error";
    if (edgeMessageNode) edgeMessageNode.textContent = descriptor.message;
    if (edgeSubtitleNode) edgeSubtitleNode.textContent = descriptor.subtitle;

    setGimmick(descriptor.gimmick);
    return descriptor.gimmick;
}

function setupCardThrowing() {
    cardNodes.forEach((cardNode) => {
        const clickTarget = cardNode.querySelector(".card") ?? cardNode;
        clickTarget.classList.add("pokeup");
        clickTarget.addEventListener("click", () => {
            const randomVariant = THROW_VARIANT_CLASSES[randomInt(0, THROW_VARIANT_CLASSES.length - 1)];
            cardNode.classList.add("card-thrown", randomVariant);
            remainingCards -= 1;
            if (stackContainer && remainingCards === 0) {
                stackContainer.classList.add("stack-collapsed");
            }
        }, { once: true });
    });
}

function fillFakeCodeLines(mode) {
    const needsCodeLines = mode === "glitch" || mode === "timeout" || mode === "edge";
    if (!needsCodeLines) return;

    if (mode === "timeout" && connectorNode) {
        connectorNode.classList.add("connector-expanded");
    }

    cardNodes.forEach((cardNode) => {
        const codeList = cardNode.querySelector(".code ul");
        if (!codeList) return;

        const numLines = randomInt(5, 10);

        for (let i = 0; i < numLines; i += 1) {
            const lineLength = LINE_LENGTH_BUCKETS[randomInt(0, LINE_LENGTH_BUCKETS.length - 1)];
            const lineNode = document.createElement("li");
            lineNode.classList.add(`line-len-${lineLength}`);
            codeList.appendChild(lineNode);
        }

        const lineNodes = Array.from(codeList.querySelectorAll("li"));
        lineNodes.forEach((lineNode, i) => {
            if (i === 0) {
                lineNode.classList.add("writeLine");
                return;
            }

            lineNodes[i - 1].addEventListener("animationend", () => {
                if (i === lineNodes.length - 1) {
                    lineNode.classList.add("errorLine");
                    lineNode.classList.add("writeLine");

                    if (mode === "glitch" || mode === "edge") {
                        setTimeout(() => {
                            consoleNodes.forEach((panel) => panel.classList.add("writing-error"));
                        }, 1200);
                    }

                    if (mode === "timeout" && errorTagNode) {
                        setTimeout(() => {
                            errorTagNode.classList.add("tag-visible");
                        }, 1200);
                    }
                } else {
                    lineNode.classList.add("writeLine");
                }
            }, { once: true });
        });
    });
}

function bootVisualEngine(mode) {
    clearCodeLists();
    if (connectorNode) connectorNode.classList.remove("connector-expanded");
    if (errorTagNode) errorTagNode.classList.remove("tag-visible");

    if (firstCard) {
        firstCard.addEventListener("animationend", () => {
            perspecNodes.forEach((node) => node.classList.add("explode"));
        }, { once: true });
    }

    let explosionCompleted = false;
    if (firstPerspec) {
        firstPerspec.addEventListener("animationend", (event) => {
            if (event.animationName !== "explode" || explosionCompleted) return;
            explosionCompleted = true;
            if (mode !== "timeout") {
                setupCardThrowing();
            }
            fillFakeCodeLines(mode);
        });
    }
}

const query = new URLSearchParams(window.location.search);
const queryStatus = normalizeStatus(query.get("status"));
const querySource = normalizeSource(query.get("source"));
const embeddedStatus = normalizeStatus(document.body?.dataset.errorCode ?? null);
const embeddedSource = normalizeSource(document.body?.dataset.errorSource ?? null);
const pathStatus = inferStatusFromPathname(window.location.pathname);
const pathSource = inferSourceFromPathname(window.location.pathname);
const timingStatus = inferStatusFromNavigationTiming();
const forcedStatus = queryStatus ?? embeddedStatus ?? pathStatus ?? timingStatus;
const source = querySource ?? embeddedSource ?? pathSource ?? "nginx";

if (forcedStatus) {
    const mode = applyCodeDescriptor(forcedStatus, source);
    bootVisualEngine(mode);
} else {
    const mode = applyFallbackDescriptor(source);
    bootVisualEngine(mode);
}
