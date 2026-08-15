const express = require("express");
const path = require("path");
const EventEmitter = require("events");
const WebSocket = require("ws");
const http = require("http");

const TwitchAuth = require("./auth/twitch");
const TwitchCallback = require("./auth/callback");
const KickCallback = require("./auth/kickCallback");
const YouTubeCallback = require("./auth/youtubeCallback");
const Account = require("./data/account");
const PlatformConnections = require("./data/platformConnections");
const db = require("./database");


// ============================================================
// Kick Emote Helpers
// ============================================================

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function buildKickEmoteHtml(content, emotes = []) {

    if (
        !content ||
        !Array.isArray(emotes) ||
        emotes.length === 0
    ) {
        return {
            text: content || "",
            emotes: {}
        };
    }

    const replacements = [];

    for (const emote of emotes) {

        const emoteId = emote?.emote_id;

        if (!emoteId) continue;

        if (!Array.isArray(emote.positions)) {
            continue;
        }

        for (const position of emote.positions) {

            const start = Number(position?.s);
            const end = Number(position?.e);

            if (
                !Number.isInteger(start) ||
                !Number.isInteger(end) ||
                start < 0 ||
                end < start ||
                start >= content.length
            ) {
                continue;
            }

            replacements.push({
                start,
                end: Math.min(
                    end,
                    content.length - 1
                ),
                emoteId: String(emoteId)
            });
        }
    }

    if (!replacements.length) {
        return {
            text: escapeHtml(content),
            emotes: {}
        };
    }

    replacements.sort(
        (a, b) =>
            a.start - b.start ||
            b.end - a.end
    );

    const valid = [];
    let lastEnd = -1;

    for (const replacement of replacements) {

        if (replacement.start <= lastEnd) {
            continue;
        }

        valid.push(replacement);
        lastEnd = replacement.end;
    }

    let result = "";
    let cursor = 0;

    for (const replacement of valid) {

        if (replacement.start > cursor) {

            result += escapeHtml(
                content.slice(
                    cursor,
                    replacement.start
                )
            );
        }

        const emoteUrl =
            `https://files.kick.com/emotes/${encodeURIComponent(
                replacement.emoteId
            )}/fullsize`;

        result +=
            `<img class="emote kick-emote" ` +
            `src="${emoteUrl}" ` +
            `alt="" ` +
            `loading="lazy" ` +
            `decoding="async" ` +
            `draggable="false">`;

        cursor = replacement.end + 1;
    }

    if (cursor < content.length) {

        result += escapeHtml(
            content.slice(
                cursor
            )
        );
    }

    return {
        text: result,
        emotes: {}
    };
}


// ============================================================
// Bridge
// ============================================================

class Bridge extends EventEmitter {

    constructor() {

        super();

        this.broadcasterId = null;
        this.broadcasters = new Map();
        this.defaultOverlayId = null;

        const PORT =
            process.env.PORT || 3000;

        this.app = express();

        // ========================================================
        // CORS
        // ========================================================

        this.app.use(
            (req, res, next) => {

                res.header(
                    "Access-Control-Allow-Origin",
                    "*"
                );

                res.header(
                    "Access-Control-Allow-Methods",
                    "GET,POST,OPTIONS"
                );

                res.header(
                    "Access-Control-Allow-Headers",
                    "Content-Type"
                );

                if (req.method === "OPTIONS") {
                    return res.sendStatus(204);
                }

                next();
            }
        );

        this.app.use(express.json());

        this.app.use(
            express.static(__dirname)
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


        // ========================================================
        // Test Route
        // ========================================================

        this.app.get(
            "/test",
            (req, res) => {
                res.send(
                    "Express is working!"
                );
            }
        );


        // ========================================================
        // Root Overlay
        // ========================================================

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


        // ========================================================
        // Overlay
        // ========================================================

        this.app.get(
            "/overlay/:identifier",
            async (req, res) => {

                try {

                    const identifier =
                        String(
                            req.params.identifier || ""
                        ).trim();

                    if (!identifier) {

                        return res
                            .status(400)
                            .send(
                                "Missing overlay identifier."
                            );
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

                    res
                        .status(500)
                        .send(
                            "Failed to load overlay."
                        );
                }
            }
        );


        // ========================================================
        // Overlay Settings GET
        // ========================================================

        this.app.get(
            "/api/overlay/:identifier/settings",
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
                            SELECT *
                            FROM overlay_settings
                            WHERE overlay_id = $1
                            LIMIT 1
                            `,
                            [
                                account.overlayId
                            ]
                        );

                    if (
                        result.rows.length === 0
                    ) {

                        return res.json({
                            overlayId:
                                account.overlayId
                        });
                    }

                    return res.json(
                        result.rows[0]
                    );

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


        // ========================================================
        // Overlay Settings POST
        // ========================================================

        this.app.post(
            "/api/overlay/:identifier/settings",
            async (req, res) => {

                try {

                    const identifier =
                        String(
                            req.params.identifier || ""
                        ).trim();

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

                    const body =
                        req.body || {};

                    const allowedFields = [
                        "show_messages",
                        "show_commands",
                        "show_badges",
                        "show_emotes",
                        "show_7tv",
                        "show_twitch",
                        "show_kick",
                        "show_youtube",
                        "hidden_bots",
                        "theme"
                    ];

                    const fields = [];
                    const values = [];

                    for (
                        const field of allowedFields
                    ) {

                        if (
                            Object.prototype.hasOwnProperty.call(
                                body,
                                field
                            )
                        ) {

                            fields.push(field);
                            values.push(
                                body[field]
                            );
                        }
                    }

                    if (!fields.length) {

                        return res.json({
                            success: true
                        });
                    }

                    const columns =
                        ["overlay_id"];

                    const placeholders =
                        ["$1"];

                    const params = [
                        account.overlayId
                    ];

                    fields.forEach(
                        (
                            field,
                            index
                        ) => {

                            columns.push(
                                field
                            );

                            placeholders.push(
                                `$${index + 2}`
                            );

                            params.push(
                                values[index]
                            );
                        }
                    );

                    const updates =
                        fields.map(
                            field =>
                                `${field} = EXCLUDED.${field}`
                        );

                    await db.query(
                        `
                        INSERT INTO overlay_settings
                        (${columns.join(", ")})
                        VALUES
                        (${placeholders.join(", ")})
                        ON CONFLICT (overlay_id)
                        DO UPDATE SET
                        ${updates.join(", ")}
                        `,
                        params
                    );

                    return res.json({
                        success: true
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


        // ========================================================
        // Twitch Auth
        // ========================================================

        this.app.get(
            "/auth/twitch",
            async (req, res) => {

                try {

                    const overlayId =
                        String(
                            req.query.overlayId || ""
                        ).trim();

                    const login =
                        String(
                            req.query.login || ""
                        ).trim();

                    if (!overlayId && !login) {

                        return res
                            .status(400)
                            .send(
                                "Missing overlayId or login."
                            );
                    }

                    let account =
                        overlayId
                            ? await Account.loadByOverlayId(
                                overlayId
                            )
                            : null;

                    if (!account && login) {

                        account =
                            await Account.loadByLogin(
                                login.toLowerCase()
                            );
                    }

                    if (!account) {

                        return res
                            .status(404)
                            .send(
                                "Account not found."
                            );
                    }

                    return res.redirect(
                        TwitchAuth.getAuthUrl(
                            account.overlayId
                        )
                    );

                } catch (err) {

                    console.error(
                        "❌ Twitch auth failed:",
                        err
                    );

                    return res
                        .status(500)
                        .send(
                            "Twitch authentication failed."
                        );
                }
            }
        );


        // ========================================================
        // Twitch Callback
        // ========================================================

        this.app.get(
            "/auth/twitch/callback",
            async (req, res) => {

                try {

                    await TwitchCallback.handle(
                        req,
                        res
                    );

                } catch (err) {

                    console.error(
                        "❌ Twitch callback failed:",
                        err
                    );

                    if (!res.headersSent) {

                        res
                            .status(500)
                            .send(
                                "Twitch callback failed."
                            );
                    }
                }
            }
        );


        // ========================================================
        // Kick Callback
        // ========================================================

        this.app.get(
            "/auth/kick/callback",
            async (req, res) => {

                try {

                    await KickCallback.handle(
                        req,
                        res
                    );

                } catch (err) {

                    console.error(
                        "❌ Kick callback failed:",
                        err
                    );

                    if (!res.headersSent) {

                        res
                            .status(500)
                            .send(
                                "Kick callback failed."
                            );
                    }
                }
            }
        );


        // ========================================================
        // YouTube Callback
        // ========================================================

        this.app.get(
            "/auth/youtube/callback",
            async (req, res) => {

                try {

                    await YouTubeCallback.handle(
                        req,
                        res
                    );

                } catch (err) {

                    console.error(
                        "❌ YouTube callback failed:",
                        err
                    );

                    if (!res.headersSent) {

                        res
                            .status(500)
                            .send(
                                "YouTube callback failed."
                            );
                    }
                }
            }
        );


        // ========================================================
        // Account Info
        // ========================================================

        this.app.get(
            "/api/account/:identifier",
            async (req, res) => {

                try {

                    const identifier =
                        String(
                            req.params.identifier || ""
                        ).trim();

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
                                    "Account not found."
                            });
                    }

                    return res.json({
                        overlayId:
                            account.overlayId,

                        login:
                            account.login,

                        displayName:
                            account.displayName,

                        userId:
                            account.userId
                    });

                } catch (err) {

                    console.error(
                        "❌ Failed to load account:",
                        err
                    );

                    return res
                        .status(500)
                        .json({
                            error:
                                "Failed to load account."
                        });
                }
            }
        );


        // ========================================================
        // WebSocket Server
        // ========================================================

        this.server =
            http.createServer(
                this.app
            );

        this.wss =
            new WebSocket.Server({
                server:
                    this.server
            });


        // ========================================================
        // Start Server
        // ========================================================

        this.server.listen(
            PORT,
            () => {

                console.log(
                    `The Bridge4K running on port ${PORT}`
                );
            }
        );


        // ========================================================
        // WebSocket Connections
        // ========================================================

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

                            const login =
                                match[1]
                                    .toLowerCase();

                            const account =
                                await Account.loadByLogin(
                                    login
                                );

                            if (account) {

                                overlayId =
                                    account.overlayId;
                            }
                        }
                    }

                    // ====================================================
                    // IMPORTANT:
                    // Never fall back to the default overlay.
                    // Every WebSocket connection must belong to a
                    // specific overlay.
                    // ====================================================

                    if (!overlayId) {

                        console.warn(
                            "⚠️ WebSocket connection rejected: missing overlayId"
                        );

                        ws.close(
                            1008,
                            "Missing overlayId"
                        );

                        return;
                    }

                    ws.overlayId =
                        overlayId;

                    console.log(
                        "🎯 Overlay ID:",
                        overlayId
                    );

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

                } catch (err) {

                    console.error(
                        "❌ WebSocket initialization failed:",
                        err
                    );

                    try {

                        ws.close(
                            1011,
                            "WebSocket initialization failed"
                        );

                    } catch (_) {}
                }
            }
        );


        // ========================================================
        // Message Routing
        // ========================================================

        this.on(
            "message",
            (data) => {

                const payload =
                    JSON.stringify(
                        data
                    );

                // ====================================================
                // CRITICAL ROUTING PROTECTION
                //
                // A message without overlayId must NEVER be broadcast.
                // Previously, missing overlayId caused the message to
                // reach every connected overlay.
                // ====================================================

                if (!data.overlayId) {

                    console.warn(
                        "⚠️ Dropping message with no overlayId:",
                        data.type || "unknown"
                    );

                    return;
                }

                this.wss.clients.forEach(
                    (client) => {

                        if (
                            client.readyState !==
                            WebSocket.OPEN
                        ) {
                            return;
                        }

                        if (
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


        // ========================================================
        // Load Default Account
        // ========================================================

        this.loadDefaultAccount();
    }


    // ============================================================
    // Hidden Bot Check
    // ============================================================

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
                            bot
                                .trim()
                                .toLowerCase()
                    )
                    .filter(Boolean);

            return hiddenBots.includes(
                String(username)
                    .trim()
                    .toLowerCase()
            );

        } catch (err) {

            console.error(
                "❌ Failed to check hidden bot:",
                err
            );

            return false;
        }
    }


    // ============================================================
    // ! Command Check
    // ============================================================

    async shouldHideCommand(
        overlayId,
        text
    ) {

        if (!text) {
            return false;
        }

        const message =
            String(text).trim();

        if (
            !message.startsWith("!")
        ) {
            return false;
        }

        if (!overlayId) {
            return true;
        }

        try {

            const result =
                await db.query(
                    `
                    SELECT show_commands
                    FROM overlay_settings
                    WHERE overlay_id = $1
                    LIMIT 1
                    `,
                    [
                        overlayId
                    ]
                );

            const showCommands =
                result.rows.length > 0 &&
                result.rows[0]
                    .show_commands === true;

            return !showCommands;

        } catch (err) {

            console.error(
                "❌ Failed to check command setting:",
                err
            );

            return true;
        }
    }


    // ============================================================
    // Load Default Account
    // ============================================================

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


    // ============================================================
    // Send Message
    // ============================================================

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
                    data.color ||
                    "#ffffff",

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


    // ============================================================
    // Broadcaster Mapping
    // ============================================================

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

            this.broadcasterId =
                id;
        }

        this.send({

            type:
                "broadcaster",

            platform:
                "system",

            overlayId,

            userId:
                id
        });
    }
}


module.exports = Bridge;