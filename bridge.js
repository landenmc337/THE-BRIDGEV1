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


function buildKickEmoteHtml(
    content,
    emotes = []
) {

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

        const emoteId =
            emote?.emote_id;

        if (!emoteId) continue;

        if (!Array.isArray(emote.positions)) {
            continue;
        }


        for (
            const position of emote.positions
        ) {

            const start =
                Number(position?.s);

            const end =
                Number(position?.e);


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

                end:
                    Math.min(
                        end,
                        content.length - 1
                    ),

                emoteId:
                    String(emoteId)

            });

        }

    }


    if (!replacements.length) {

        return {

            text:
                escapeHtml(content),

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


    for (
        const replacement of replacements
    ) {

        if (
            replacement.start <=
            lastEnd
        ) {
            continue;
        }


        valid.push(
            replacement
        );

        lastEnd =
            replacement.end;

    }


    let result = "";

    let cursor = 0;


    for (
        const replacement of valid
    ) {

        if (
            replacement.start >
            cursor
        ) {

            result +=
                escapeHtml(
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


        cursor =
            replacement.end + 1;

    }


    if (
        cursor <
        content.length
    ) {

        result +=
            escapeHtml(
                content.slice(cursor)
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


        this.broadcasterId =
            null;

        this.broadcasters =
            new Map();

        this.defaultOverlayId =
            null;


        const PORT =
            process.env.PORT || 3000;


        this.app =
            express();


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


                if (
                    req.method ===
                    "OPTIONS"
                ) {

                    return res.sendStatus(
                        204
                    );

                }


                next();

            }
        );


        this.app.use(
            express.json()
        );


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
        // Overlay Settings
        // ========================================================

        this.app.get(
            "/overlay/:identifier/settings",
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
                            SELECT
                                hidden_bots,
                                show_commands
                            FROM overlay_settings
                            WHERE overlay_id = $1
                            LIMIT 1
                            `,
                            [
                                account.overlayId
                            ]
                        );


                    const row =
                        result.rows[0];


                    return res.json({

                        overlayId:
                            account.overlayId,

                        hiddenBots:
                            row?.hidden_bots ||
                            "",

                        showCommands:
                            row?.show_commands ===
                            true

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
                                (
                                    bot,
                                    index,
                                    list
                                ) =>
                                    list.indexOf(
                                        bot
                                    ) === index
                            )
                            .join(",");


                    const showCommands =
                        req.body?.showCommands ===
                        true;


                    await db.query(
                        `
                        INSERT INTO overlay_settings (
                            overlay_id,
                            hidden_bots,
                            show_commands
                        )
                        VALUES (
                            $1,
                            $2,
                            $3
                        )
                        ON CONFLICT (
                            overlay_id
                        )
                        DO UPDATE SET
                            hidden_bots =
                                EXCLUDED.hidden_bots,
                            show_commands =
                                EXCLUDED.show_commands
                        `,
                        [
                            account.overlayId,
                            hiddenBots,
                            showCommands
                        ]
                    );


                    return res.json({

                        success: true,

                        overlayId:
                            account.overlayId,

                        hiddenBots,

                        showCommands

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
        // Kick Webhook
        // ========================================================

        this.app.post(
            "/kick/webhook",
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
                            buildKickEmoteHtml(
                                message.content ||
                                    "",
                                message.emotes ||
                                    []
                            ).text,

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


        // ========================================================
        // Twitch Login
        // ========================================================

        this.app.get(
            "/auth/twitch",
            (req, res) => {

                const result =
                    TwitchAuth.buildLoginURL();


                res.redirect(
                    result.url
                );

            }
        );


        // ========================================================
        // YouTube OAuth Callback
        // ========================================================

        this.app.get(
            "/youtube/callback",
            YouTubeCallback.callback
        );


        // ========================================================
        // YouTube Login
        // ========================================================

        this.app.get(
            "/youtube/login",
            YouTubeCallback.createLogin
        );


        // ========================================================
        // Twitch OAuth Callback
        // ========================================================

        this.app.get(
            "/auth/twitch/callback",
            TwitchCallback
        );


        // ========================================================
        // Kick Connection Status
        // ========================================================

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
                                connected:
                                    false,
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
                                connected:
                                    false,
                                error:
                                    "Account not found."
                            });

                    }


                    const connection =
                        await PlatformConnections.load(
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
                            connected:
                                false,
                            error:
                                "Failed to check Kick status."
                        });

                }

            }
        );


        // ========================================================
        // Kick Login
        // ========================================================

        this.app.get(
            "/kick/login",
            KickCallback.createLogin
        );


        // ========================================================
        // Kick OAuth Callback
        // ========================================================

        this.app.get(
            "/kick/callback",
            KickCallback.callback
        );


        // ========================================================
        // HTTP + WebSocket Server
        // ========================================================

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


                this.wss.clients.forEach(
                    (client) => {

                        if (
                            client.readyState !==
                            WebSocket.OPEN
                        ) {

                            return;

                        }


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
                result.rows.length ===
                0
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
                String(
                    username
                )
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


            // Fail closed.
            // Commands stay hidden if the
            // setting cannot be read.
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
                "init",

            userId:
                id,

            overlayId

        });

    }

}


// ============================================================
// Database Connection
// ============================================================

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


// ============================================================
// Bridge
// ============================================================

const bridge =
    new Bridge();


bridge.loadDefaultAccount();


// ============================================================
// Export Bridge
// ============================================================

module.exports =
    bridge;


// ============================================================
// Load Platforms
// ============================================================

require(
    "./platforms/twitch"
);


require(
    "./platforms/youtube"
);