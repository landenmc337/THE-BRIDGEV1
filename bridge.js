const express = require("express");
const path = require("path");
const EventEmitter = require("events");
const WebSocket = require("ws");
const http = require("http");

const TwitchAuth = require("./auth/twitch");
const TwitchCallback = require("./auth/callback");
const KickCallback = require("./auth/kickCallback");
const YouTubeAuth = require("./auth/youtube");
const YouTubeCallback = require("./auth/youtubeCallback");
const Account = require("./data/account");
const PlatformConnections = require("./data/platformConnections");
const db = require("./database");

function getFallbackChatColor(platform, username) {
    const normalizedPlatform =
        String(platform || "").toLowerCase();

    const normalizedUsername =
        String(username || "user");

    const palettes = {
        kick: [
            "#53FC18",
            "#7CFF4F",
            "#22C55E",
            "#A3E635",
            "#34D399",
            "#84CC16"
        ],

        youtube: [
            "#FF4D4D",
            "#FF6B6B",
            "#F43F5E",
            "#FB7185",
            "#EF4444",
            "#F97316"
        ],

        default: [
            "#A970FF",
            "#53FC18",
            "#FF4D4D",
            "#00F2EA",
            "#F59E0B",
            "#38BDF8"
        ]
    };

    const palette =
        palettes[normalizedPlatform] ||
        palettes.default;

    let hash = 0;

    for (let i = 0; i < normalizedUsername.length; i++) {
        hash =
            ((hash << 5) - hash) +
            normalizedUsername.charCodeAt(i);

        hash |= 0;
    }

    return palette[
        Math.abs(hash) % palette.length
    ];
}

function resolveChatColor(data) {
    const providedColor =
        typeof data?.color === "string"
            ? data.color.trim()
            : "";

    if (providedColor) {
        return providedColor;
    }

    return getFallbackChatColor(
        data?.platform,
        data?.username
    );
}

function renderKickEmotes(text, emotes = []) {
    if (!text || !Array.isArray(emotes) || emotes.length === 0) {
        return text || "";
    }

    const replacements = [];

    for (const emote of emotes) {
        const id = emote?.emote_id;

        const positions =
            Array.isArray(emote?.positions)
                ? emote.positions
                : [];

        if (!id) continue;

        for (const position of positions) {
            const start =
                Number(position?.s);

            const end =
                Number(position?.e);

            if (
                !Number.isInteger(start) ||
                !Number.isInteger(end)
            ) {
                continue;
            }

            replacements.push({
                start,
                end,
                id
            });
        }
    }

    replacements.sort(
        (a, b) =>
            b.start - a.start
    );

    let html = text;

    for (const emote of replacements) {
        const url =
            `https://files.kick.com/emotes/${emote.id}/fullsize`;

        const img =
            `<img class="emote" src="${url}" alt="" loading="lazy" decoding="async" draggable="false">`;

        html =
            html.slice(0, emote.start) +
            img +
            html.slice(emote.end + 1);
    }

    return html;
}

class Bridge extends EventEmitter {

    constructor() {

        super();

        this.broadcasterId = null;

        this.broadcasters =
            new Map();

        this.defaultOverlayId =
            null;

        const PORT =
            process.env.PORT || 3000;

        this.app =
            express();

        // ============================================================
        // CORS
        // ============================================================

        this.app.use(
            (req, res, next) => {

                const allowedOrigins = [
                    "http://localhost:3000",
                    "https://www.thebridge4k.com"
                ];

                const origin =
                    req.headers.origin;

                if (
                    allowedOrigins.includes(origin)
                ) {

                    res.header(
                        "Access-Control-Allow-Origin",
                        origin
                    );

                }

                res.header(
                    "Access-Control-Allow-Methods",
                    "GET,POST,OPTIONS"
                );

                res.header(
                    "Access-Control-Allow-Headers",
                    "Content-Type"
                );

                if (
                    req.method === "OPTIONS"
                ) {

                    return res.sendStatus(
                        204
                    );

                }

                next();

            }
        );

        this.app.use(
            express.static(
                __dirname
            )
        );

        console.log(
            "__dirname:",
            __dirname
        );

        this.app.use(
            (req, res, next) => {

                console.log(
                    req.method,
                    req.url
                );

                next();

            }
        );

        // ============================
        // Test Route
        // ============================

        this.app.get(
            "/test",
            (req, res) => {

                res.send(
                    "Express is working!"
                );

            }
        );
// ============================
// Overlay Settings
// ============================

this.app.get(
    "/overlay/:identifier/settings",
    async (req, res) => {

        try {

            const identifier =
                String(
                    req.params.identifier || ""
                ).trim();

            if (!identifier) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Missing overlay identifier."
                    });

            }

            let account =
                await Account.loadByOverlayId(
                    identifier
                );

            if (!account) {

                account =
                    await Account.loadByLogin(
                        identifier.toLowerCase()
                    );

            }

            if (!account) {

                return res
                    .status(404)
                    .json({
                        error:
                            "Overlay not found."
                    });

            }

            const result =
                await db.query(
                    `
                    SELECT hidden_bots
                    FROM overlay_settings
                    WHERE overlay_id = $1
                    LIMIT 1
                    `,
                    [
                        account.overlayId
                    ]
                );

            const hiddenBots =
                result.rows.length
                    ? result.rows[0].hidden_bots || ""
                    : "";

            return res.json({
                overlayId:
                    account.overlayId,

                hiddenBots
            });

        } catch (err) {

            console.error(
                "❌ Failed to load overlay settings:",
                err
            );

            return res
                .status(500)
                .json({
                    error:
                        "Failed to load overlay settings."
                });

        }

    }
);


this.app.post(
    "/overlay/:identifier/settings",
    express.json(),
    async (req, res) => {

        try {

            const identifier =
                String(
                    req.params.identifier || ""
                ).trim();

            if (!identifier) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Missing overlay identifier."
                    });

            }

            let account =
                await Account.loadByOverlayId(
                    identifier
                );

            if (!account) {

                account =
                    await Account.loadByLogin(
                        identifier.toLowerCase()
                    );

            }

            if (!account) {

                return res
                    .status(404)
                    .json({
                        error:
                            "Overlay not found."
                    });

            }

            const rawHiddenBots =
                typeof req.body?.hiddenBots ===
                "string"
                    ? req.body.hiddenBots
                    : "";

            const hiddenBots =
                rawHiddenBots
                    .split(",")
                    .map(
                        bot =>
                            bot
                                .trim()
                                .toLowerCase()
                    )
                    .filter(Boolean)
                    .filter(
                        (bot, index, list) =>
                            list.indexOf(bot) ===
                            index
                    )
                    .join(",");


            await db.query(
                `
                INSERT INTO overlay_settings (
                    overlay_id,
                    hidden_bots
                )
                VALUES ($1, $2)
                ON CONFLICT (overlay_id)
                DO UPDATE SET
                    hidden_bots = EXCLUDED.hidden_bots
                `,
                [
                    account.overlayId,
                    hiddenBots
                ]
            );


            return res.json({

                success: true,

                overlayId:
                    account.overlayId,

                hiddenBots

            });

        } catch (err) {

            console.error(
                "❌ Failed to save overlay settings:",
                err
            );

            return res
                .status(500)
                .json({
                    error:
                        "Failed to save overlay settings."
                });

        }

    }
);
        // ============================
        // Overlay
        // ============================

        this.app.get(
            "/",
            (req, res) => {

                res.sendFile(
                    path.join(
                        __dirname,
                        "overlay.html"
                    )
                );

            }
        );

        this.app.get(
            "/overlay/:identifier",
            async (req, res) => {

                try {

                    const identifier =
                        String(
                            req.params.identifier ||
                            ""
                        ).trim();

                    if (!identifier) {

                        return res
                            .status(400)
                            .send(
                                "Missing overlay identifier."
                            );

                    }

                    // New creator-specific URLs
                    // use the permanent overlayId.
                    let account =
                        (
                            await Account.loadAll()
                        ).find(
                            item =>
                                item.overlayId ===
                                identifier
                        ) || null;

                    // Keep existing
                    // login-based URLs working
                    // during the transition.
                    if (!account) {

                        account =
                            await Account.loadByLogin(
                                identifier.toLowerCase()
                            );

                    }

                    if (!account) {

                        return res
                            .status(404)
                            .send(`
                                <h2>The Bridge4K</h2>
                                <p>Overlay not found.</p>
                            `);

                    }

                    res.sendFile(
                        path.join(
                            __dirname,
                            "overlay.html"
                        )
                    );

                } catch (err) {

                    console.error(
                        "❌ Failed to load overlay:",
                        err
                    );

                    res.status(500).send(
                        "Failed to load overlay."
                    );

                }

            }
        );

        const fs =
            require("fs");

        this.app.get(
            "/debug-overlay",
            (req, res) => {

                res.type(
                    "text/plain"
                );

                res.send(
                    fs.readFileSync(
                        path.join(
                            __dirname,
                            "overlay.html"
                        ),
                        "utf8"
                    )
                );

            }
        );

        // ============================
        // Kick Webhook
        // ============================

        this.app.post(
            "/kick/webhook",
            express.json(),
            async (req, res) => {

                console.log(
                    "📨 Kick Webhook:",
                    JSON.stringify(
                        req.body,
                        null,
                        2
                    )
                );

                try {

                    const message =
                        req.body || {};

                    const broadcasterId =
                        message.broadcaster?.user_id ??
                        message.broadcaster?.id ??
                        message.broadcaster_id ??
                        message.channel?.user_id ??
                        message.channel?.id ??
                        null;

                    const broadcasterLogin =
                        message.broadcaster?.username ||
                        message.broadcaster?.login ||
                        message.channel?.username ||
                        message.channel?.login ||
                        null;

                    let connection =
                        null;

                    if (
                        broadcasterId !==
                        null
                    ) {

                        connection =
                            await PlatformConnections.loadByPlatformUserId(
                                "kick",
                                String(
                                    broadcasterId
                                )
                            );

                    }

                    if (
                        !connection &&
                        broadcasterLogin
                    ) {

                        connection =
                            await PlatformConnections.loadByPlatformLogin(
                                "kick",
                                broadcasterLogin
                            );

                    }

                    if (!connection) {

                        console.warn(
                            "⚠️ Kick webhook could not resolve an account:",
                            {
                                broadcasterId,
                                broadcasterLogin
                            }
                        );

                        return res.sendStatus(
                            200
                        );

                    }

                    this.send({

                        type:
                            "message",

                        platform:
                            "kick",

                        overlayId:
                            connection.overlayId,

                        username:
                            message.sender?.username ||
                            message.sender?.name ||
                            "Kick User",

                        text:
                            renderKickEmotes(
                                message.content ||
                                "",
                                message.emotes ||
                                []
                            ),

                        userId:
                            message.sender?.user_id ||
                            message.sender?.id ||
                            "",

                        badges: {},

                        emotes: {},

                        timestamp:
                            Date.now()

                    });

                    return res.sendStatus(
                        200
                    );

                } catch (err) {

                    console.error(
                        "❌ Kick webhook routing failed:",
                        err
                    );

                    return res.sendStatus(
                        500
                    );

                }

            }
        );

        // ============================
        // Twitch Login
        // ============================

        this.app.get(
            "/auth/twitch",
            (req, res) => {

                const login =
                    req.query.login || null;

                const result =
                    TwitchAuth.buildLoginURL(
                        login
                    );

                res.redirect(
                    result.url
                );

            }
        );

        // ============================
        // YouTube OAuth Callback
        // ============================

        this.app.get(
            "/youtube/callback",
            YouTubeCallback.callback
        );

        // ============================
        // YouTube Login
        // ============================

        this.app.get(
            "/youtube/login",
            YouTubeCallback.createLogin
        );

        // ============================
        // Twitch OAuth Callback
        // ============================

        this.app.get(
            "/auth/twitch/callback",
            TwitchCallback
        );

        // ============================
        // Account / Overlay Status
        // ============================

        this.app.get(
            "/account/status",
            async (req, res) => {

                try {

                    const login =
                        String(
                            req.query.login ||
                            ""
                        ).trim();

                    if (!login) {

                        return res
                            .status(400)
                            .json({
                                found: false,
                                error:
                                    "Missing login."
                            });

                    }

                    const account =
                        await Account.loadByLogin(
                            login.toLowerCase()
                        );

                    if (!account) {

                        return res
                            .status(404)
                            .json({
                                found: false,
                                error:
                                    "Account not found."
                            });

                    }

                    return res.json({

                        found:
                            true,

                        overlayId:
                            account.overlayId,

                        login:
                            account.login,

                        displayName:
                            account.displayName ||
                            null

                    });

                } catch (err) {

                    console.error(
                        "❌ Failed to load account status:",
                        err
                    );

                    return res
                        .status(500)
                        .json({
                            found: false,
                            error:
                                "Failed to load account status."
                        });

                }

            }
        );

        // ============================
        // Kick Connection Status
        // ============================

        this.app.get(
            "/kick/status",
            async (req, res) => {

                try {

                    const login =
                        req.query.login;

                    if (!login) {

                        return res
                            .status(400)
                            .json({
                                connected: false,
                                error:
                                    "Missing login."
                            });

                    }

                    const account =
                        await Account.loadByLogin(
                            login
                        );

                    if (!account) {

                        return res
                            .status(404)
                            .json({
                                connected: false,
                                error:
                                    "Account not found."
                            });

                    }

                    const connection =
                        await require(
                            "./data/platformConnections"
                        ).load(
                            account.overlayId,
                            "kick"
                        );

                    return res.json({

                        connected:
                            !!connection,

                        displayName:
                            connection?.displayName ||
                            null,

                        login:
                            connection?.login ||
                            null

                    });

                } catch (err) {

                    console.error(
                        "❌ Failed to check Kick status:",
                        err
                    );

                    return res
                        .status(500)
                        .json({
                            connected: false,
                            error:
                                "Failed to check Kick status."
                        });

                }

            }
        );

        // ============================
        // Platform Connection Status
        // ============================

        this.app.get(
            "/platform/status",
            async (req, res) => {

                try {

                    const login =
                        String(
                            req.query.login || ""
                        )
                            .trim()
                            .toLowerCase();

                    const platform =
                        String(
                            req.query.platform || ""
                        )
                            .trim()
                            .toLowerCase();

                    if (!login) {

                        return res
                            .status(400)
                            .json({
                                connected: false,
                                error:
                                    "Missing login."
                            });

                    }

                    if (
                        ![
                            "twitch",
                            "kick",
                            "youtube"
                        ].includes(platform)
                    ) {

                        return res
                            .status(400)
                            .json({
                                connected: false,
                                error:
                                    "Invalid platform."
                            });

                    }

                    let connection = null;

                    // ====================================================
                    // First: Find the Bridge account
                    // ====================================================

                    const account =
                        await Account.loadByLogin(
                            login
                        );

                    // ====================================================
                    // Second: Try the account's overlay ID
                    // ====================================================

                    if (
                        account &&
                        account.overlayId
                    ) {

                        connection =
                            await PlatformConnections.load(
                                account.overlayId,
                                platform
                            );

                    }

                    // ====================================================
                    // Third: If not found, try the platform login
                    // ====================================================

                    if (!connection) {

                        connection =
                            await PlatformConnections.loadByPlatformLogin(
                                platform,
                                login
                            );

                    }

                    // ====================================================
                    // Return status
                    // ====================================================

                    if (!connection) {

                        return res.json({

                            connected: false,

                            platform,

                            displayName:
                                null,

                            login:
                                null

                        });

                    }

                    return res.json({

                        connected: true,

                        platform,

                        displayName:
                            connection.displayName ||
                            null,

                        login:
                            connection.login ||
                            null

                    });

                } catch (err) {

                    console.error(
                        "❌ Failed to check platform status:",
                        err
                    );

                    return res
                        .status(500)
                        .json({

                            connected: false,

                            error:
                                "Failed to check platform status."

                        });

                }

            }
        );

        // ============================
        // Kick Login
        // ============================

        this.app.get(
            "/kick/login",
            KickCallback.createLogin
        );

        // ============================
        // Kick OAuth Callback
        // ============================

        this.app.get(
            "/kick/callback",
            KickCallback.callback
        );

        // ============================
        // HTTP + WebSocket Server
        // ============================

        const server =
            http.createServer(
                this.app
            );

        this.wss =
            new WebSocket.Server({
                server
            });

        server.listen(
            PORT,
            () => {

                console.log(
                    `The Bridge4K running on port ${PORT}`
                );

            }
        );

        // ============================
        // WebSocket Connections
        // ============================

        this.wss.on(
            "connection",
            async (ws, req) => {

                console.log(
                    "🖥 Overlay Connected"
                );

                try {

                    const url =
                        new URL(
                            req.url,
                            `http://${req.headers.host || "localhost"}`
                        );

                    let overlayId =
                        url.searchParams.get(
                            "overlayId"
                        );

                    if (!overlayId) {

                        const match =
                            url.pathname.match(
                                /^\/overlay\/([^/]+)$/
                            );

                        if (match) {

                            const identifier =
                                match[1];

                            // Prefer a permanent overlayId.
                            const accounts =
                                await Account.loadAll();

                            const accountByOverlayId =
                                accounts.find(
                                    account =>
                                        account.overlayId ===
                                        identifier
                                );

                            if (
                                accountByOverlayId
                            ) {

                                overlayId =
                                    accountByOverlayId.overlayId;

                            } else {

                                // Legacy login URL fallback.
                                const account =
                                    await Account.loadByLogin(
                                        identifier.toLowerCase()
                                    );

                                if (account) {

                                    overlayId =
                                        account.overlayId;

                                }

                            }

                        }

                    }

                    // Keep the existing root
                    // overlay working.
                    if (!overlayId) {

                        overlayId =
                            this.defaultOverlayId;

                    }

                    ws.overlayId =
                        overlayId;

                    console.log(
                        "🎯 Overlay ID:",
                        overlayId ||
                        "none"
                    );

                    if (overlayId) {

                        const broadcasterId =
                            this.broadcasters.get(
                                overlayId
                            );

                        if (broadcasterId) {

                            ws.send(
                                JSON.stringify({

                                    type:
                                        "init",

                                    userId:
                                        broadcasterId,

                                    overlayId

                                })
                            );

                        }

                    }

                } catch (err) {

                    console.error(
                        "❌ WebSocket initialization failed:",
                        err
                    );

                }

            }
        );

        // ============================
        // Message Routing
        // ============================

        this.on(
            "message",
            (data) => {

                const payload =
                    JSON.stringify(
                        data
                    );

                this.wss.clients.forEach(
                    (client) => {

                        if (
                            client.readyState !==
                            WebSocket.OPEN
                        ) {

                            return;

                        }

                        // Only send the message
                        // to the overlay belonging
                        // to this account.
                        if (
                            data.overlayId &&
                            client.overlayId !==
                                data.overlayId
                        ) {

                            return;

                        }

                        client.send(
                            payload
                        );

                    }
                );

            }
        );

        // ============================
        // Load Default Account
        // ============================

        this.loadDefaultAccount();

    }

    async loadDefaultAccount() {

        try {

            const accounts =
                await Account.loadAll();

            if (
                accounts.length > 0
            ) {

                this.defaultOverlayId =
                    accounts[0].overlayId;

                console.log(
                    "🎯 Default overlay:",
                    this.defaultOverlayId
                );

            }

        } catch (err) {

            console.error(
                "❌ Failed to load default account:",
                err
            );

        }

    }
    
async shouldHideUser(
    overlayId,
    username
) {

    if (
        !overlayId ||
        !username
    ) {
        return false;
    }

    try {

        const result =
            await db.query(
                `
                SELECT hidden_bots
                FROM overlay_settings
                WHERE overlay_id = $1
                LIMIT 1
                `,
                [
                    overlayId
                ]
            );

        if (
            result.rows.length === 0
        ) {
            return false;
        }

        const hiddenBots =
            String(
                result.rows[0].hidden_bots ||
                ""
            )
                .split(",")
                .map(
                    bot =>
                        bot.trim().toLowerCase()
                )
                .filter(Boolean);

        return hiddenBots.includes(
            String(
                username
            ).trim().toLowerCase()
        );

    } catch (err) {

        console.error(
            "❌ Failed to check hidden bot:",
            err
        );

        // Fail open.
        // If settings cannot be read,
        // do not hide the message.
        return false;

    }

}
    send(data) {

        this.emit(
            "message",
            {

                type:
                    data.type,

                platform:
                    data.platform,

                overlayId:
                    data.overlayId ||
                    null,

                username:
                    data.username,

                color:
                    resolveChatColor(data),

                text:
                    data.text,

                badges:
                    data.badges ||
                    {},

                emotes:
                    data.emotes ||
                    {},

                channelId:
                    data.channelId ||
                    "",

                userId:
                    data.userId ||
                    "",

                sevenTV:
                    data.sevenTV || {
                        paint: null,
                        badge: null,
                        effects: [],
                        raw: null
                    },

                timestamp:
                    Date.now()

            }
        );

    }

    setBroadcasterId(
        id,
        overlayId = null
    ) {

        if (overlayId) {

            this.broadcasters.set(
                overlayId,
                id
            );

            console.log(
                `📺 Broadcaster mapped: ${overlayId} → ${id}`
            );

        } else {

            // Legacy fallback for
            // the current account.
            this.broadcasterId =
                id;

        }

        this.send({

            type:
                "init",

            userId:
                id,

            overlayId

        });

    }

}

// ============================
// Database Connection
// ============================

(async () => {

    try {

        const result =
            await db.query(
                "SELECT NOW()"
            );

        console.log(
            "✅ Connected to Postgres!"
        );

        console.log(
            result.rows[0]
        );

    } catch (err) {

        console.error(
            "❌ Postgres connection failed:"
        );

        console.error(
            err
        );

    }

})();

// ============================
// Bridge
// ============================

const bridge =
    new Bridge();

bridge.loadDefaultAccount();

// ============================
// Export Bridge
// ============================

module.exports =
    bridge;

// ============================
// Load Platforms
// ============================

require(
    "./platforms/twitch"
);

require(
    "./platforms/youtube"
);