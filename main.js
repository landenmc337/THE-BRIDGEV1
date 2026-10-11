
console.log("✅ main.js loaded");

// ===============================
// Appearance Settings
// ===============================

const root = document.documentElement;

const liveFont =
    RelaySettings.font === "Segoe UI (Chatterino)"
        ? '"Segoe UI", sans-serif'
        : RelaySettings.font === "Impact"
            ? "Impact, sans-serif"
            : `"${RelaySettings.font}"`;

root.style.setProperty("--chat-font", liveFont);

console.log("🎨 Live font:", RelaySettings.font);

console.log(
    "🎨 CSS font:",
    getComputedStyle(root).getPropertyValue("--chat-font")
);

root.style.setProperty(
    "--chat-font-size",
    `${RelaySettings.fontSize}px`
);

root.style.setProperty(
    "--badge-size",
    `${RelaySettings.fontSize}px`
);

root.style.setProperty(
    "--platform-size",
    `${RelaySettings.fontSize}px`
);

root.style.setProperty(
    "--emote-size",
    `${RelaySettings.emoteSize}px`
);

root.style.setProperty("--bubble-color", RelaySettings.bubbleColor);

root.style.setProperty(
    "--show-platform-icons",
    RelaySettings.showPlatformIcons ? "1" : "0"
);

// ===============================
// Default Variables
// ===============================

root.style.setProperty("--text-color", RelaySettings.textColor);
root.style.setProperty("--shadow-color", RelaySettings.shadowColor);

root.style.setProperty(
    "--shadow-blur",
    `${RelaySettings.shadowBlur}px`
);

root.style.setProperty("--message-background", "transparent");
root.style.setProperty("--message-border", "none");
root.style.setProperty("--message-radius", "0px");

// ===============================
// Themes
// ===============================

switch (RelaySettings.theme) {
    case "minimal":
        root.style.setProperty("--text-color", "#FFFFFF");
        root.style.setProperty("--shadow-color", "rgba(0,0,0,.75)");
        root.style.setProperty("--shadow-blur", "4px");
        break;

    case "dark":
        root.style.setProperty(
            "--message-background",
            "rgba(0,0,0,.65)"
        );

        root.style.setProperty(
            "--message-border",
            "1px solid rgba(255,255,255,.12)"
        );

        root.style.setProperty("--message-radius", "12px");
        break;

    case "glow":
        root.style.setProperty(
            "--message-background",
            "rgba(0,255,255,.12)"
        );

        root.style.setProperty("--message-border", "1px solid cyan");
        root.style.setProperty("--message-radius", "16px");
        root.style.setProperty("--shadow-color", "cyan");
        root.style.setProperty("--shadow-blur", "20px");
        break;

    case "red":
        root.style.setProperty(
            "--message-background",
            "rgba(255,0,0,.15)"
        );

        root.style.setProperty("--message-border", "1px solid red");
        root.style.setProperty("--message-radius", "16px");
        root.style.setProperty("--shadow-color", "red");
        root.style.setProperty("--shadow-blur", "20px");
        break;
}

// ===============================
// Overlay Position
// ===============================

const chat = document.getElementById("chat");

if (!chat) {
    console.error("❌ Chat container not found.");
    throw new Error("Chat container not found.");
}

console.log("The Bridge4K Overlay Loaded");

chat.style.bottom = `${RelaySettings.y}px`;

if (RelaySettings.align === "right") {
    chat.style.right = `${RelaySettings.x}px`;
    chat.style.left = "auto";
} else {
    chat.style.left = `${RelaySettings.x}px`;
    chat.style.right = "auto";
}

// ===============================
// Overlay ID
// Supports query parameter and path
// ===============================

const currentUrl = new URL(window.location.href);
const urlParams = currentUrl.searchParams;
const pathParts = currentUrl.pathname.split("/").filter(Boolean);

const pathOverlayId =
    pathParts[0] === "overlay" && pathParts[1]
        ? pathParts[1]
        : null;

const overlayId =
    urlParams.get("overlayId") ||
    pathOverlayId;

console.log("🎯 Overlay ID:", overlayId || "none");

if (!overlayId) {
    console.error(
        "❌ No overlay ID found. Expected ?overlayId=ID or /overlay/ID."
    );
}

// ===============================
// WebSocket Connection
// Automatic Recovery
// ===============================

const protocol =
    currentUrl.protocol === "https:" ? "wss:" : "ws:";

// Keep the existing host and route.
// Do not append a duplicate overlay ID when it
// is already included in the URL path.

const host = currentUrl.host;
const pathname = currentUrl.pathname;

const socketUrl = (() => {
    const wsUrl = new URL(
        `${protocol}//${host}${pathname}`
    );

    // Preserve other query parameters, if present.
    currentUrl.searchParams.forEach((value, key) => {
        wsUrl.searchParams.append(key, value);
    });

    // Add the ID only when it was not already in the path
    // and was not supplied as a query parameter.
    if (
        overlayId &&
        !pathOverlayId &&
        !wsUrl.searchParams.has("overlayId")
    ) {
        wsUrl.searchParams.set("overlayId", overlayId);
    }

    return wsUrl.toString();
})();

console.log("🔌 WebSocket URL:", socketUrl);

let socket = null;
let reconnectTimer = null;
let reconnectAttempt = 0;
let manuallyStopped = false;
let initLoadInProgress = false;

const MIN_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

// ===============================
// Reconnection
// ===============================

function scheduleReconnect() {
    if (manuallyStopped || reconnectTimer !== null) {
        return;
    }

    const baseDelay = Math.min(
        MIN_RECONNECT_DELAY * (2 ** reconnectAttempt),
        MAX_RECONNECT_DELAY
    );

    const jitter = Math.floor(Math.random() * 500);

    const delay = Math.min(
        baseDelay + jitter,
        MAX_RECONNECT_DELAY
    );

    reconnectAttempt += 1;

    console.warn(
        `🔄 Reconnecting to The Bridge4K in ${delay}ms ` +
        `(attempt ${reconnectAttempt})`
    );

    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectWebSocket();
    }, delay);
}

// ===============================
// Overlay Initialization
// ===============================

async function handleInit(data) {
    if (initLoadInProgress) {
        console.warn(
            "⏳ Overlay initialization already in progress."
        );
        return;
    }

    initLoadInProgress = true;

    try {
        console.log("🎯 Overlay initialized:", data.overlayId);

        if (typeof SevenTVManager !== "undefined") {
            console.log("Loading 7TV...", data.userId);

            await SevenTVManager.load(data.userId);

            console.log(
                "7TV emotes loaded:",
                Object.keys(SevenTVManager.emotes || {}).length
            );
        }

        if (typeof BTTVFFZManager !== "undefined") {
            console.log("Loading BTTV + FFZ...", data.userId);

            await BTTVFFZManager.load(
                data.userId,
                data.username
            );

            console.log("BTTV + FFZ loaded:", {
                bttv: Object.keys(
                    BTTVFFZManager.bttvEmotes || {}
                ).length,

                ffz: Object.keys(
                    BTTVFFZManager.ffzEmotes || {}
                ).length
            });
        }
    } catch (error) {
        console.error(
            "⚠️ Overlay initialization failed:",
            error
        );
    } finally {
        initLoadInProgress = false;
    }
}

// ===============================
// Connect WebSocket
// ===============================

function connectWebSocket() {
    if (manuallyStopped) {
        return;
    }

    if (!overlayId) {
        console.error(
            "❌ Cannot connect: overlay ID is missing."
        );
        return;
    }

    if (
        socket &&
        (
            socket.readyState === WebSocket.CONNECTING ||
            socket.readyState === WebSocket.OPEN
        )
    ) {
        return;
    }

    let currentSocket;

    try {
        currentSocket = new WebSocket(socketUrl);
        socket = currentSocket;
    } catch (error) {
        console.error(
            "❌ Could not create WebSocket:",
            error
        );

        socket = null;
        scheduleReconnect();
        return;
    }

    // ===============================
    // Connection Opened
    // ===============================

    currentSocket.onopen = () => {
        if (socket !== currentSocket) {
            return;
        }

        reconnectAttempt = 0;

        console.log(
            "🟢 The Bridge4K WebSocket connected."
        );
    };

    // ===============================
    // Incoming Messages
    // ===============================

    currentSocket.onmessage = async (event) => {
        if (socket !== currentSocket) {
            return;
        }

        let data;

        try {
            data = JSON.parse(event.data);
        } catch (error) {
            console.error(
                "⚠️ Received invalid WebSocket JSON:",
                error
            );
            return;
        }

        if (data.type === "init") {
            await handleInit(data);
            return;
        }

        try {
            addMessage(data);
        } catch (error) {
            console.error(
                "⚠️ Could not render incoming chat message:",
                error
            );
        }
    };

    // ===============================
    // Connection Closed
    // ===============================

    currentSocket.onclose = (event) => {
        if (socket !== currentSocket) {
            return;
        }

        console.warn(
            "🔴 The Bridge4K WebSocket closed.",
            {
                code: event.code,
                reason: event.reason || "(no reason provided)",
                clean: event.wasClean
            }
        );

        socket = null;
        scheduleReconnect();
    };

    // ===============================
    // Connection Error
    // ===============================

    currentSocket.onerror = (error) => {
        if (socket !== currentSocket) {
            return;
        }

        console.error(
            "⚠️ The Bridge4K WebSocket encountered an error:",
            error
        );

        // Closing the connection triggers onclose,
        // which schedules the next reconnection.

        try {
            if (
                currentSocket.readyState === WebSocket.CONNECTING ||
                currentSocket.readyState === WebSocket.OPEN
            ) {
                currentSocket.close();
            }
        } catch (closeError) {
            console.warn(
                "Could not close errored WebSocket:",
                closeError
            );
        }
    };
}

// ===============================
// Start Overlay Connection
// ===============================

if (overlayId) {
    connectWebSocket();
} else {
    console.error(
        "❌ WebSocket connection was not started because the overlay ID is missing."
    );
}
