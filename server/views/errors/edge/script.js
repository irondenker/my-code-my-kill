const edgeCodes = ["400", "408", "413", "414", "429", "431", "494", "495", "496", "502"];

const descriptors = {
    "400": {
        kicker: "nginx edge layer",
        title: "BAD REQUEST",
        message: "The request could not be understood by the server.",
        subtitle: "ERR_BAD_REQUEST",
    },
    "408": {
        kicker: "nginx edge layer",
        title: "REQUEST TIMEOUT",
        message: "The request timed out before the server received the full payload.",
        subtitle: "ERR_REQUEST_TIMEOUT",
    },
    "413": {
        kicker: "nginx edge layer",
        title: "PAYLOAD TOO LARGE",
        message: "The request body is larger than the allowed upload limit.",
        subtitle: "ERR_CONTENT_TOO_LARGE",
    },
    "414": {
        kicker: "nginx edge layer",
        title: "URI TOO LONG",
        message: "The requested URI is too long to be processed.",
        subtitle: "ERR_URI_TOO_LONG",
    },
    "429": {
        kicker: "nginx edge layer",
        title: "TOO MANY REQUESTS",
        message: "Too many requests were sent in a short period. Try again later.",
        subtitle: "ERR_RATE_LIMITED",
    },
    "431": {
        kicker: "nginx edge layer",
        title: "HEADER TOO LARGE",
        message: "Request headers exceed the acceptable size.",
        subtitle: "ERR_REQUEST_HEADER_FIELDS_TOO_LARGE",
    },
    "494": {
        kicker: "nginx edge layer",
        title: "INVALID REQUEST HEADER",
        message: "The request was rejected because header data is invalid or too large.",
        subtitle: "ERR_NGINX_494",
    },
    "495": {
        kicker: "nginx edge layer",
        title: "TLS CERTIFICATE ERROR",
        message: "The client certificate could not be validated during TLS negotiation.",
        subtitle: "ERR_NGINX_495",
    },
    "496": {
        kicker: "nginx edge layer",
        title: "TLS CERTIFICATE REQUIRED",
        message: "A valid client certificate is required to access this endpoint.",
        subtitle: "ERR_NGINX_496",
    },
    "502": {
        kicker: "nginx edge layer",
        title: "BAD GATEWAY",
        message: "The upstream application returned an invalid response.",
        subtitle: "ERR_BAD_GATEWAY",
    },
    "405": {
        kicker: "application fallback",
        title: "METHOD NOT ALLOWED",
        message: "This HTTP method is not allowed for the requested resource.",
        subtitle: "ERR_METHOD_NOT_ALLOWED",
    },
    "409": {
        kicker: "application fallback",
        title: "CONFLICT",
        message: "The request could not be completed because of a state conflict.",
        subtitle: "ERR_CONFLICT",
    },
    "410": {
        kicker: "application fallback",
        title: "RESOURCE GONE",
        message: "The requested resource is no longer available.",
        subtitle: "ERR_GONE",
    },
    "422": {
        kicker: "application fallback",
        title: "UNPROCESSABLE REQUEST",
        message: "The request format was valid, but the server could not process the content.",
        subtitle: "ERR_UNPROCESSABLE_ENTITY",
    },
    "501": {
        kicker: "application fallback",
        title: "NOT IMPLEMENTED",
        message: "This function is not implemented by the current application path.",
        subtitle: "ERR_NOT_IMPLEMENTED",
    },
};

const defaultDescriptor = {
    kicker: "nginx edge layer",
    title: "REQUEST INTERRUPTED",
    message: "The request could not be completed at the edge or application layer.",
    subtitle: "edge codes: 400, 408, 413, 414, 429, 431, 494, 495, 496, 502",
};

const edgeKickerNode = document.getElementById("edge-kicker");
const edgeCodeNode = document.getElementById("edge-code");
const edgeTitleNode = document.getElementById("edge-title");
const edgeMessageNode = document.getElementById("edge-message");
const edgeSubtitleNode = document.getElementById("edge-subtitle");
const badgesContainer = document.getElementById("edge-badges");
const badgeNodes = Array.from(document.querySelectorAll("#edge-badges .badge"));

const stackContainer = document.querySelector(".stack-container");
const cardNodes = Array.from(document.querySelectorAll(".card-container"));
const consoleNodes = Array.from(document.querySelectorAll(".writing"));
const perspecNodes = Array.from(document.querySelectorAll(".perspec"));
const firstPerspec = document.querySelector(".perspec");
const firstCard = document.querySelector(".card");

let remainingCards = stackContainer ? stackContainer.children.length : 0;

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

function activateBadge(code) {
    let matched = false;
    badgeNodes.forEach((badge) => {
        const isActive = badge.textContent === code;
        badge.classList.toggle("active", isActive);
        if (isActive) matched = true;
    });

    if (!badgesContainer) return;

    const oldDynamic = badgesContainer.querySelector(".badge.dynamic");
    if (oldDynamic) {
        oldDynamic.remove();
    }

    if (!matched) {
        const badge = document.createElement("span");
        badge.className = "badge dynamic active";
        badge.textContent = code;
        badgesContainer.appendChild(badge);
    }
}

function applyCodeDescriptor(code) {
    const descriptor = descriptors[code] ?? defaultDescriptor;

    if (edgeKickerNode) edgeKickerNode.textContent = descriptor.kicker;
    if (edgeCodeNode) edgeCodeNode.textContent = code;
    if (edgeTitleNode) edgeTitleNode.textContent = descriptor.title;
    if (edgeMessageNode) edgeMessageNode.textContent = descriptor.message;
    if (edgeSubtitleNode) edgeSubtitleNode.textContent = descriptor.subtitle;

    activateBadge(code);
}

function startCodeTicker() {
    if (!edgeCodeNode || badgeNodes.length === 0) return;

    let index = 0;
    applyCodeDescriptor(edgeCodes[index]);

    setInterval(() => {
        index = (index + 1) % edgeCodes.length;
        applyCodeDescriptor(edgeCodes[index]);
    }, 1300);
}

function setupCardThrowing() {
    cardNodes.forEach((cardNode) => {
        cardNode.classList.add("pokeup");
        cardNode.addEventListener("click", () => {
            const upOrDown = [800, -800];
            const randomY = upOrDown[Math.floor(Math.random() * upOrDown.length)];
            const randomX = Math.floor(Math.random() * 1000) - 1000;
            cardNode.style.transform = `translate(${randomX}px, ${randomY}px) rotate(-540deg)`;
            cardNode.style.transition = "transform 1s ease, opacity 1.8s";
            cardNode.style.opacity = "0";
            remainingCards -= 1;
            if (stackContainer && remainingCards === 0) {
                stackContainer.style.width = "0";
                stackContainer.style.height = "0";
            }
        });
    });
}

function fillFakeCodeLines() {
    cardNodes.forEach((cardNode) => {
        const codeList = cardNode.querySelector(".code ul");
        if (!codeList) return;
        const numLines = randomInt(5, 10);

        for (let i = 0; i < numLines; i += 1) {
            const lineLength = randomInt(24, 96);
            const lineNode = document.createElement("li");
            lineNode.classList.add(`line-${i}`);
            lineNode.style.setProperty("--linelength", `${lineLength}%`);
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
                    setTimeout(() => {
                        consoleNodes.forEach((panel) => panel.classList.add("writing-error"));
                    }, 1200);
                } else {
                    lineNode.classList.add("writeLine");
                }
            });
        });
    });
}

if (firstCard) {
    firstCard.addEventListener("animationend", () => {
        perspecNodes.forEach((node) => node.classList.add("explode"));
    });
}

if (firstPerspec) {
    firstPerspec.addEventListener("animationend", (event) => {
        if (event.animationName !== "explode") return;
        setupCardThrowing();
        fillFakeCodeLines();
    });
}

const queryStatus = normalizeStatus(new URLSearchParams(window.location.search).get("status"));
const embeddedStatus = normalizeStatus(document.body?.dataset.errorCode ?? null);
const forcedStatus = queryStatus ?? embeddedStatus;

if (forcedStatus) {
    applyCodeDescriptor(forcedStatus);
} else {
    startCodeTicker();
}
