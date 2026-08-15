const tmi = require("tmi.js");
const axios = require("axios");
const bridge = require("../bridge");
const SevenTVCosmetics = require("../managers/sevenTVCosmetics");
const config = require("../config");
const { downloadBadges } = require("../assetDownloader");
const Account = require("../data/account");

require("dotenv").config();

const clients = new Map();

// Twitch users currently timed out on each overlay.
const timedOutUsers = new Map();

function rememberTimedOutUser(overlayId, userId, username, duration) {
    if (!overlayId) return;

    if (!timedOutUsers.has(overlayId)) {
        timedOutUsers.set(overlayId, new Map());
    }

    const users = timedOutUsers.get(overlayId);

    const key = String(
        userId || username || ""
    ).toLowerCase();

    if (!key) return;

    const seconds = Number(duration);

    const expiresAt =
        Number.isFinite(seconds) && seconds > 0
            ? Date.now() + seconds * 1000
            : Infinity;

    users.set(key, expiresAt);
}

function isUserTimedOut(
    overlayId,
    userId,
    username
) {
    const users =
        timedOutUsers.get(
            overlayId
        );

    if (!users) return false;

    const keys = [
        userId,
        username
    ]
        .filter(Boolean)
        .map(value =>
            String(value).toLowerCase()
        );

    for (const key of keys) {

        const expiresAt =
            users.get(key);

        if (!expiresAt) continue;

        if (
            expiresAt !== Infinity &&
            expiresAt <= Date.now()
        ) {
            users.delete(key);
            continue;
        }

        return true;
    }

    return false;
}

function sendTimeoutToOverlay(
    account,
    username,
    userId
) {
    bridge.send({
        type: "timeout",
        platform: "twitch",
        overlayId: account.overlayId,
        username: username || "",
        userId: userId || "",
        text: "",
        badges: {},
        emotes: {}
    });
}

async function getValidAccessToken(account) {

    try {

        await axios.get(
            "https://id.twitch.tv/oauth2/validate",
            {
                headers: {
                    Authorization:
                        `OAuth ${account.accessToken}`
                }
            }
        );

        console.log(
            `🔐 Twitch token valid: ${account.login}`
        );

        return account.accessToken;

    } catch (err) {

        console.log(
            `♻️ Twitch token expired/invalid: ${account.login}`
        );

        if (!account.refreshToken) {
            throw new Error(
                `No refresh token available for ${account.login}`
            );
        }

        const response =
            await axios.post(
                "https://id.twitch.tv/oauth2/token",
                null,
                {
                    params: {
                        client_id:
                            process.env.TWITCH_CLIENT_ID,

                        client_secret:
                            process.env.TWITCH_CLIENT_SECRET,

                        grant_type:
                            "refresh_token",

                        refresh_token:
                            account.refreshToken
                    }
                }
            );

        const tokens =
            response.data;

        await Account.save({
            ...account,

            accessToken:
                tokens.access_token,

            refreshToken:
                tokens.refresh_token ||
                account.refreshToken,

            connectedAt:
                Date.now()
        });

        account.accessToken =
            tokens.access_token;

        account.refreshToken =
            tokens.refresh_token ||
            account.refreshToken;

        console.log(
            `✅ Twitch token refreshed: ${account.login}`
        );

        return account.accessToken;
    }
}

async function initialize() {

    console.log(
        "🔄 Twitch initialization starting..."
    );

    try {

        console.log(
            "🔍 Loading Twitch accounts from database..."
        );

        const accounts =
            await Account.loadAll();

        console.log(
            `📋 Found ${accounts.length} Twitch account(s).`
        );

        if (!accounts.length) {

            console.error(
                "❌ No Twitch accounts connected."
            );

            return;
        }

        for (const account of accounts) {

            if (
                clients.has(
                    account.overlayId
                )
            ) {

                console.log(
                    `⏭️ Already connected: ${account.login}`
                );

                continue;
            }

            await connectAccount(
                account
            );
        }

    } catch (err) {

        console.error(
            "❌ Twitch initialization failed:",
            err
        );
    }
}

async function connectAccount(account) {

    console.log(
        `🔌 Connecting Twitch account: ${account.login}`
    );

    try {

        const accessToken =
            await getValidAccessToken(
                account
            );

        const client =
            new tmi.Client({

                identity: {
                    username:
                        account.login,

                    password:
                        `oauth:${accessToken}`
                },

                channels: [
                    account.login
                ]
            });

        clients.set(
            account.overlayId,
            {
                client,
                account
            }
        );

        registerEvents(
            client,
            account
        );

        console.log(
            `🔗 Calling Twitch connect for ${account.login}...`
        );

        await client.connect();

        console.log(
            `✅ Twitch connection established: ${account.login}`
        );

    } catch (err) {

        console.error(
            `❌ Failed to connect Twitch account ${account.login}:`,
            err.response?.data ||
            err.message ||
            err
        );

        clients.delete(
            account.overlayId
        );
    }
}

function registerEvents(
    client,
    account
) {

    client.on(
        "connected",
        async () => {

            console.log(
                `✅ Connected to Twitch: ${account.login}`
            );

            try {

                const token =
                    await axios.post(
                        "https://id.twitch.tv/oauth2/token",
                        null,
                        {
                            params: {
                                client_id:
                                    process.env.TWITCH_CLIENT_ID,

                                client_secret:
                                    process.env.TWITCH_CLIENT_SECRET,

                                grant_type:
                                    "client_credentials"
                            }
                        }
                    );

                const appAccessToken =
                    token.data.access_token;

                const user =
                    await axios.get(
                        "https://api.twitch.tv/helix/users",
                        {
                            headers: {
                                Authorization:
                                    `Bearer ${appAccessToken}`,

                                "Client-Id":
                                    process.env.TWITCH_CLIENT_ID
                            },

                            params: {
                                login:
                                    account.login
                            }
                        }
                    );

                if (
                    !user.data.data.length
                ) {

                    console.error(
                        `❌ Could not find Twitch user: ${account.login}`
                    );

                    return;
                }

                const broadcasterId =
                    user.data.data[0].id;

                console.log(
                    `📺 Broadcaster ${account.login}:`,
                    broadcasterId
                );

                bridge.setBroadcasterId(
                    broadcasterId,
                    account.overlayId
                );

                try {

                    await downloadBadges(
                        account.login,
                        account.overlayId
                    );

                    console.log(
                        `✅ Channel badges updated: ${account.login}`
                    );

                } catch (err) {

                    console.error(
                        `❌ Failed to update channel badges for ${account.login}:`,
                        err.message
                    );
                }

            } catch (err) {

                console.error(
                    `❌ Twitch API error for ${account.login}:`,
                    err.response?.data ||
                    err
                );
            }
        }
    );


    // ============================================
    // Twitch timeout event
    // ============================================

    client.on(
        "timeout",
        (
            channel,
            username,
            reason,
            duration,
            userstate
        ) => {

            const userId =
                userstate?.["user-id"] ||
                "";

            rememberTimedOutUser(
                account.overlayId,
                userId,
                username,
                duration
            );

            console.log(
                `⏱️ [${account.login}] Timeout detected: ${username} (${duration}s) userId=${userId}`
            );

            sendTimeoutToOverlay(
                account,
                username,
                userId
            );
        }
    );


    // ============================================
    // Twitch CLEARCHAT fallback
    // ============================================

    client.on(
        "clearchat",
        (
            channel,
            username,
            userstate
        ) => {

            if (!username) return;

            const userId =
                userstate?.["user-id"] ||
                "";

            const duration =
                userstate?.["ban-duration"] ||
                0;

            rememberTimedOutUser(
                account.overlayId,
                userId,
                username,
                duration
            );

            console.log(
                `🧹 [${account.login}] CLEARCHAT detected: ${username} (${duration || "ban"}) userId=${userId}`
            );

            sendTimeoutToOverlay(
                account,
                username,
                userId
            );
        }
    );


    // ============================================
    // Twitch chat messages
    // ============================================

    client.on(
        "message",
        async (
            channel,
            tags,
            message,
            self
        ) => {

            if (self) return;

            console.log(
                `💬 [${account.login}]`,
                tags["display-name"],
                message
            );

            const username = (
                tags.username ||
                tags.login ||
                tags["display-name"] ||
                ""
            ).toLowerCase();


            // ========================================
            // Block timed-out users
            // ========================================

            if (
                isUserTimedOut(
                    account.overlayId,
                    tags["user-id"],
                    username
                )
            ) {

                console.log(
                    `🚫 [${account.login}] Blocking timed-out user: ${username}`
                );

                return;
            }


            const trimmedMessage =
                message.trim();


            // ========================================
            // Hide commands
            // ========================================

            if (
                config.filters.hideCommands &&
                trimmedMessage.startsWith(
                    config.filters.commandPrefix
                )
            ) {

                console.log(
                    "🚫 Hidden Command:",
                    trimmedMessage
                );

                return;
            }


            // ========================================
            // Hidden users
            // ========================================

            if (
    await bridge.shouldHideUser(
        account.overlayId,
        username
    )
) {

    console.log(
        "🚫 Hidden Bot:",
        username,
        "for overlay:",
        account.overlayId
    );

    return;
}

            const sevenTV =
                await SevenTVCosmetics.get(
                    tags["user-id"]
                );


            bridge.send({

                platform:
                    "twitch",

                overlayId:
                    account.overlayId,

                username:
                    tags["display-name"],

                color:
                    getUsernameColor(
                        tags["display-name"],
                        tags.color
                    ),

                text:
                    message,

                badges:
                    tags.badges || {},

                emotes:
                    tags.emotes || {},

                channelId:
                    account.userId || "",

                userId:
                    tags["user-id"] || "",

                sevenTV
            });
        }
    );
}

const DEFAULT_USERNAME_COLORS = [
    "#FF0000",
    "#0000FF",
    "#008000",
    "#B22222",
    "#FF7F50",
    "#9ACD32",
    "#FF4500",
    "#2E8B57",
    "#DAA520",
    "#D2691E",
    "#5F9EA0",
    "#1E90FF",
    "#FF69B4",
    "#8A2BE2",
    "#00FF7F"
];

function getUsernameColor(
    username,
    color
) {

    if (color) {
        return color;
    }

    let hash = 0;

    for (
        let i = 0;
        i < username.length;
        i++
    ) {

        hash =
            username.charCodeAt(i) +
            ((hash << 5) - hash);
    }

    return DEFAULT_USERNAME_COLORS[
        Math.abs(hash) %
        DEFAULT_USERNAME_COLORS.length
    ];
}

initialize();

module.exports = {
    initialize
};