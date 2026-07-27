console.log("✅ main.js loaded");
document.documentElement.style.setProperty("--chat-font-size", `${RelaySettings.fontSize}px`);
document.documentElement.style.setProperty("--badge-size", `${RelaySettings.badgeSize}px`);
document.documentElement.style.setProperty("--platform-size", `${RelaySettings.badgeSize}px`);
document.documentElement.style.setProperty("--emote-size", `${RelaySettings.emoteSize}px`);

const root = document.documentElement;

// Default Variables
root.style.setProperty("--text-color", RelaySettings.textColor);
root.style.setProperty("--shadow-color", RelaySettings.shadowColor);
root.style.setProperty("--shadow-blur", `${RelaySettings.shadowBlur}px`);

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
        root.style.setProperty("--message-background", "rgba(0,0,0,.65)");
        root.style.setProperty("--message-border", "1px solid rgba(255,255,255,.12)");
        root.style.setProperty("--message-radius", "12px");
        break;

    case "glow":
        root.style.setProperty("--message-background", "rgba(0,255,255,.12)");
        root.style.setProperty("--message-border", "1px solid cyan");
        root.style.setProperty("--message-radius", "16px");
        root.style.setProperty("--shadow-color", "cyan");
        root.style.setProperty("--shadow-blur", "20px");
        break;

    case "red":
        root.style.setProperty("--message-background", "rgba(255,0,0,.15)");
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
    console.log("RelayIt Dashboard");
    throw new Error("Dashboard page");
}

if (!chat) {
    console.log("RelayIt Dashboard Loaded");
} else {
    console.log("RelayIt Overlay Loaded");
}

chat.style.bottom = `${RelaySettings.y}px`;

if (RelaySettings.align === "right") {

    chat.style.right = `${RelaySettings.x}px`;
    chat.style.left = "auto";

} else {

    chat.style.left = `${RelaySettings.x}px`;
    chat.style.right = "auto";

}

// ===============================
// WebSocket
// ===============================

const socket =
  location.hostname === "localhost"
    ? new WebSocket("ws://localhost:3000")
    : new WebSocket("wss://relayitv1-4k-69f1.up.railway.app");

socket.onopen = () => {

    console.log("🟢 Connected");

};

socket.onmessage = async (event) => {
    
    console.log("📨 WebSocket received:", event.data);

    const data = JSON.parse(event.data);

    if (data.type === "init") {

        console.log("Loading 7TV...", data.userId);

        await SevenTVManager.load(data.userId);

        console.log(Object.keys(SevenTVManager.emotes).length);

        return;

    }

    addMessage(data);

};

socket.onclose = () => {

    console.log("Disconnected");

};

socket.onerror = console.error;