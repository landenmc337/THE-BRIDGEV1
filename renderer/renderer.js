function createPlatform(data) {

    if (
        !data.platform ||
        data.platform === "system"
    ) {
        return "";
    }

    const platform =
        PlatformManager.normalize(
            data.platform
        );

    const icon =
        IconManager.get(
            platform
        );

    if (!icon) {
        return "";
    }

    return `
        <img
            class="platform-icon"
            src="${icon}"
            alt="${data.platform}"
        >
    `;
}


function createBadges(data) {

    let html =
        '<span class="badges">';


    // Twitch / YouTube badges
    if (data.badges) {

        for (
            const [
                badge,
                version
            ] of Object.entries(
                data.badges
            )
        ) {

            const badgePath =
                AssetManager.getBadge(
                    data.platform,
                    badge,
                    version,
                    data.channelId,
                    data.overlayId
                );

            if (!badgePath) {
                continue;
            }

            html += `
                <img
                    class="badge"
                    src="${badgePath}"
                    alt="${badge}"
                    title="${badge}"
                >
            `;
        }
    }


    // 7TV Badge
    if (
        data.sevenTV?.badge?.images?.length
    ) {

        const badgeUrl =
            data.sevenTV.badge.images.find(
                img =>
                    img.scale === 4
            )?.url ??
            data.sevenTV.badge.images[0].url;

        html += `
            <img
                class="badge"
                src="${badgeUrl}"
                alt="${data.sevenTV.badge.name}"
                title="${data.sevenTV.badge.name}"
            >
        `;
    }

    html +=
        "</span>";

    return html ===
        '<span class="badges"></span>'
        ? ""
        : html;
}


function getFallbackColor(
    username
) {

    let hash = 0;

    for (
        const char of username.toLowerCase()
    ) {

        hash =
            (
                hash * 31 +
                char.charCodeAt(0)
            ) | 0;
    }

    const hue =
        Math.abs(hash) % 360;

    return `hsl(${hue}, 65%, 62%)`;
}


function createUsername(data) {

    /*
     * 7TV Namepaint
     *
     * The paint renderer receives the complete 7TV paint object.
     * paintManager.js converts the PaintData layers into CSS.
     */
    const style =
        window.buildPaint
            ? window.buildPaint(
                data.sevenTV?.paint
            )
            : null;


    /*
     * Convert the JavaScript style object into valid CSS.
     */
    const css =
        style
            ? Object.entries(style)
                .map(
                    ([key, value]) =>
                        `${key.replace(
                            /[A-Z]/g,
                            m =>
                                "-" +
                                m.toLowerCase()
                        )}:${value}`
                )
                .join(";")
            : "";


    /*
     * Normal username color remains as the fallback.
     *
     * If a 7TV paint exists, the paint's
     * background-clip/text-fill properties take over.
     */
    const usernameColor =
        data.color ||
        getFallbackColor(
            data.username
        );


    const colorStyle =
        `color:${usernameColor};`;


    return `
        <span
            class="username${style ? " seventv-paint" : ""}"
            ${style ? `data-seventv-paint-id="${data.sevenTV?.paint?.id || ""}"` : ""}
            style="${colorStyle}${css}"
        >
            ${data.username}:
        </span>
    `;
}


function createText(data) {

    let html =
        data.text || "";


    // ========================================
    // Standard emotes
    // ========================================

    if (
        typeof EmoteManager !==
        "undefined"
    ) {

        html =
            EmoteManager.process(
                html,
                data.emotes
            );
    }


    // ========================================
    // 7TV emotes
    // ========================================

    if (
        typeof SevenTVManager !==
        "undefined"
    ) {

        html =
            SevenTVManager.process(
                html
            );
    }


    // ========================================
    // BTTV + FFZ Emotes
    // ========================================

    if (
        typeof BTTVFFZManager !==
        "undefined"
    ) {

        html =
            BTTVFFZManager.process(
                html
            );
    }


    // ========================================
    // Deeno4k Custom Message Color
    // ========================================

    const isDeeno =
        String(
            data.username || ""
        ).toLowerCase() === "deeno4k";


    if (isDeeno) {

        html = `
            <span
                class="deeno-message"
                style="color:#FF1A1A;"
            >
                ${html}
            </span>
        `;
    }


    return `
        <span class="text">
            ${html}
        </span>
    `;
}


// ============================================
// Fade Timer
// ============================================

function getFadeTimer() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const value =
        Number(
            params.get("fadeTimer")
        );


    if (
        !Number.isFinite(value) ||
        value <= 0
    ) {
        return 0;
    }


    return value;
}


// ============================================
// Add Message
// ============================================

function addMessage(data) {

    const chat =
        document.getElementById(
            "chat"
        );


    if (!chat) {

        console.error(
            "Chat container not found."
        );

        return;
    }


    // ========================================
    // Twitch timeout control message
    // ========================================

    if (
        data.type === "timeout"
    ) {

        const timeoutUserId =
            String(
                data.userId || ""
            ).toLowerCase();


        const timeoutUsername =
            String(
                data.username || ""
            ).toLowerCase();


        console.log(
            "🧹 Removing timed-out Twitch user:",
            timeoutUsername,
            timeoutUserId
        );


        chat
            .querySelectorAll(
                ".message"
            )
            .forEach(
                message => {

                    const messageUserId =
                        String(
                            message.dataset.userId ||
                            ""
                        ).toLowerCase();


                    const messageUsername =
                        String(
                            message.dataset.username ||
                            ""
                        ).toLowerCase();


                    if (
                        (
                            timeoutUserId &&
                            messageUserId ===
                            timeoutUserId
                        ) ||
                        (
                            timeoutUsername &&
                            messageUsername ===
                            timeoutUsername
                        )
                    ) {

                        message.remove();
                    }
                }
            );


        return;
    }


    // ========================================
    // Hidden Bot Filter
    // ========================================
    //
    // Empty list = show ALL bots.
    //
    // Example:
    // hiddenBots=nightbot,moobot
    //
    // Only those usernames are hidden.
    // ========================================

    const messageUsername =
        String(
            data.username || ""
        ).trim().toLowerCase();


    const hiddenBots =
        Array.isArray(
            RelaySettings.hiddenBots
        )
            ? RelaySettings.hiddenBots
            : [];


    if (
        data.platform === "twitch" &&
        messageUsername &&
        hiddenBots.includes(
            messageUsername
        )
    ) {

        console.log(
            "🤖 Hidden bot:",
            messageUsername
        );

        return;
    }


    // ========================================
    // Message Layout
    // ========================================

    const layoutName =
        RelaySettings.showBubble
            ? "bubble"
            : "classic";


    const html =
        Layouts[
            layoutName
        ](data);


    const message =
        document.createElement(
            "div"
        );


    message.className =
        `message layout-${layoutName} new-message`;


    // ========================================
    // Store Twitch user ID
    // ========================================

    if (data.userId) {

        message.dataset.userId =
            String(
                data.userId
            );
    }


    // ========================================
    // Store username as fallback
    // ========================================

    if (data.username) {

        message.dataset.username =
            String(
                data.username
            ).toLowerCase();
    }


    // ========================================
    // Render message
    // ========================================

    message.innerHTML =
        html;


    chat.appendChild(
        message
    );


    // ========================================
    // Keep only newest 20 messages
    // ========================================

    while (
        chat.children.length > 20
    ) {

        const oldestMessage =
            chat.firstElementChild;


        if (!oldestMessage) {
            break;
        }


        oldestMessage.remove();
    }


    // ========================================
    // Play message animation
    // ========================================

    if (
        typeof playMessageAnimation ===
        "function"
    ) {

        playMessageAnimation(
            message
        );
    }


    // ========================================
    // Fade Timer
    // ========================================

    const fadeTimer =
        getFadeTimer();


    if (
        fadeTimer > 0
    ) {

        setTimeout(
            () => {

                if (
                    !message.isConnected
                ) {
                    return;
                }


                message.classList.add(
                    "fade-out"
                );


                setTimeout(
                    () => {

                        if (
                            message.isConnected
                        ) {

                            message.remove();
                        }

                    },
                    450
                );

            },
            fadeTimer * 1000
        );
    }
}