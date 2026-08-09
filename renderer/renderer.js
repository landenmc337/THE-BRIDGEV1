function createPlatform(data) {

    if (!data.platform || data.platform === "system") {
        return "";
    }

    const platform = PlatformManager.normalize(data.platform);
    const icon = IconManager.get(platform);

    if (!icon) {
        return "";
    }

    return `<img class="platform-icon" src="${icon}" alt="${data.platform}">`;

}

function createBadges(data) {

    let html = '<span class="badges">';

    // Twitch / YouTube badges
    if (data.badges) {

        for (const [badge, version] of Object.entries(data.badges)) {

            const badgePath = AssetManager.getBadge(
    data.platform,
    badge,
    version,
    data.channelId,
    data.overlayId
);
            if (!badgePath) continue;

            html += `
                <img
                    class="badge"
                    src="${badgePath}"
                    alt="${badge}"
                    title="${badge}"
                >`;

        }

    }

    // 7TV Badge
    if (data.sevenTV?.badge?.images?.length) {

        const badgeUrl =
            data.sevenTV.badge.images.find(img => img.scale === 4)?.url ??
            data.sevenTV.badge.images[0].url;

        html += `
            <img
                class="badge"
                src="${badgeUrl}"
                alt="${data.sevenTV.badge.name}"
                title="${data.sevenTV.badge.name}"
            >`;

    }

    html += "</span>";

    return html === '<span class="badges"></span>' ? "" : html;

}

function getFallbackColor(username) {

    let hash = 0;

    for (const char of username.toLowerCase()) {
        hash = (hash * 31 + char.charCodeAt(0)) | 0;
    }

    const hue = Math.abs(hash) % 360;

    return `hsl(${hue}, 65%, 62%)`;

}

function createUsername(data) {

    const style = window.buildPaint
        ? window.buildPaint(data.sevenTV?.paint)
        : null;

    const css = style
        ? Object.entries(style)
            .map(([key, value]) =>
                `${key.replace(/[A-Z]/g, m => "-" + m.toLowerCase())}:${value}`)
            .join(";")
        : "";

    const usernameColor = data.color || getFallbackColor(data.username);
    const colorStyle = `color:${usernameColor};`;

    return `<span class="username" style="${colorStyle}${css}">${data.username}:</span>`;

}

function createText(data) {

    let html = data.text || "";

    if (typeof EmoteManager !== "undefined") {
        html = EmoteManager.process(html, data.emotes);
    }

    if (typeof SevenTVManager !== "undefined") {
        html = SevenTVManager.process(html);
    }

    return `<span class="text">${html}</span>`;

}

function addMessage(data) {

    const chat = document.getElementById("chat");

    if (!chat) {
        console.error("Chat container not found.");
        return;
    }

    const layoutName =
        (typeof RelaySettings !== "undefined" &&
            RelaySettings.layout &&
            Layouts[RelaySettings.layout])
            ? RelaySettings.layout
            : "classic";

    const html = Layouts[layoutName](data);

    const message = document.createElement("div");

    message.className = `message layout-${layoutName} new-message`;

    message.innerHTML = html;

    chat.appendChild(message);

    if (typeof playMessageAnimation === "function") {
        playMessageAnimation(message);
    }

}