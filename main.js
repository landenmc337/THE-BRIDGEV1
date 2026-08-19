console.log("✅ main.js loaded");

const root = document.documentElement;

// ===============================
// Appearance Settings
// ===============================

const liveFont =
    RelaySettings.font === "Segoe UI (Chatterino)"
        ? '"Segoe UI", sans-serif'
        : RelaySettings.font === "Impact"
            ? "Impact, sans-serif"
            : `"${RelaySettings.font}"`;

root.style.setProperty(
    "--chat-font",
    liveFont
);

console.log("🎨 Live font:", RelaySettings.font);

console.log(
    "🎨 CSS font:",
    getComputedStyle(document.documentElement)
        .getPropertyValue("--chat-font")
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

root.style.setProperty(
    "--bubble-color",
    RelaySettings.bubbleColor
);

root.style.setProperty(
    "--show-platform-icons",
    RelaySettings.showPlatformIcons
        ? "1"
        : "0"
);

// ===============================
// Default Variables
// ===============================

root.style.setProperty(
    "--text-color",
    RelaySettings.textColor
);

root.style.setProperty(
    "--shadow-color",
    RelaySettings.shadowColor
);

root.style.setProperty(
    "--shadow-blur",
    `${RelaySettings.shadowBlur}px`
);

root.style.setProperty(
    "--message-background",
    "transparent"
);

root.style.setProperty(
    "--message-border",
    "none"
);

root.style.setProperty(
    "--message-radius",
    "0px"
);

// ===============================
// Themes
// ===============================

switch (RelaySettings.theme) {

    case "minimal":

        root.style.setProperty(
            "--text-color",
            "#FFFFFF"
        );

        root.style.setProperty(
            "--shadow-color",
            "rgba(0,0,0,.75)"
        );

        root.style.setProperty(
            "--shadow-blur",
            "4px"
        );

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

        root.style.setProperty(
            "--message-radius",
            "12px"
        );

        break;


    case "glow":

        root.style.setProperty(
            "--message-background",
            "rgba(0,255,255,.12)"
        );

        root.style.setProperty(
            "--message-border",
            "1px solid cyan"
        );

        root.style.setProperty(
            "--message-radius",
            "16px"
        );

        root.style.setProperty(
            "--shadow-color",
            "cyan"
        );

        root.style.setProperty(
            "--shadow-blur",
            "20px"
        );

        break;


    case "red":

        root.style.setProperty(
            "--message-background",
            "rgba(255,0,0,.15)"
        );

        root.style.setProperty(
            "--message-border",
            "1px solid red"
        );

        root.style.setProperty(
            "--message-radius",
            "16px"
        );

        root.style.setProperty(
            "--shadow-color",
            "red"
        );

        root.style.setProperty(
            "--shadow-blur",
            "20px"
        );

        break;
}

// ===============================
// Overlay Position
// ===============================

const chat =
    document.getElementById("chat");

if (!chat) {

    console.error(
        "❌ Chat container not found."
    );

    throw new Error(
        "Chat container not found."
    );
}

console.log(
    "RelayIt Overlay Loaded"
);

chat.style.bottom =
    `${RelaySettings.y}px`;

if (
    RelaySettings.align === "right"
) {

    chat.style.right =
        `${RelaySettings.x}px`;

    chat.style.left =
        "auto";

} else {

    chat.style.left =
        `${RelaySettings.x}px`;

    chat.style.right =
        "auto";
}

// ===============================
// Overlay ID
// ===============================

const urlParams =
    new URLSearchParams(
        window.location.search
    );

const overlayId =
    urlParams.get("overlayId");

console.log(
    "🎯 Overlay ID:",
    overlayId || "none"
);

if (!overlayId) {

    console.warn(
        "⚠️ No overlayId provided in URL."
    );
}

// ===============================
// WebSocket
// ===============================

const protocol =
    location.protocol === "https:"
        ? "wss:"
        : "ws:";

const host =
    location.host;

const pathname =
    window.location.pathname;

const socketUrl =
    `${protocol}//${host}${pathname}` +
    `${
        overlayId
            ? `?overlayId=${encodeURIComponent(overlayId)}`
            : ""
    }`;

console.log(
    "🔌 WebSocket URL:",
    socketUrl
);

const socket =
    new WebSocket(socketUrl);

socket.onopen = () => {

    console.log(
        "🟢 Connected"
    );
};

socket.onmessage = async (event) => {

    console.log(
        "📨 WebSocket received:",
        event.data
    );

    const data =
        JSON.parse(event.data);

    if (
        data.type === "init"
    ) {

        console.log(
            "🎯 Overlay initialized:",
            data.overlayId
        );

        // ===============================
        // 7TV
        // ===============================

        console.log(
            "Loading 7TV...",
            data.userId
        );

        await SevenTVManager.load(
            data.userId
        );

        console.log(
            Object.keys(
                SevenTVManager.emotes
            ).length
        );


        // ===============================
        // BTTV + FFZ
        // ===============================

        console.log(
            "Loading BTTV + FFZ...",
            data.userId
        );

        if (
            typeof BTTVFFZManager !==
            "undefined"
        ) {

            await BTTVFFZManager.load(
                data.userId
            );

            console.log(
                "BTTV + FFZ loaded:",
                {
                    bttv:
                        Object.keys(
                            BTTVFFZManager.bttvEmotes
                        ).length,

                    ffz:
                        Object.keys(
                            BTTVFFZManager.ffzEmotes
                        ).length
                }
            );

        }

        return;
    }

    addMessage(data);
};


// ===============================
// Automatic Update Detection
// ===============================
//
// When Railway deploys a new version,
// the existing WebSocket connection
// closes. Instead of leaving the user
// stuck on the old version, reload the
// overlay automatically.
//
// This means users do NOT have to
// manually refresh their OBS browser
// source after deployments.
// ===============================

socket.onclose = () => {

    console.log(
        "🔴 Bridge4K connection closed."
    );

    console.log(
        "🔄 Reloading overlay automatically..."
    );

    setTimeout(() => {

        window.location.reload();

    }, 1500);
};


socket.onerror = (error) => {

    console.error(
        "⚠️ WebSocket error:",
        error
    );
};