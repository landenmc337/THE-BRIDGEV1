const express = require("express");
const path = require("path");
const EventEmitter = require("events");
const WebSocket = require("ws");
const http = require("http");
const crypto = require("crypto");
const rateLimit =
    require("express-rate-limit");

const TwitchAuth = require("./auth/twitch");

const TwitchCallback = require("./auth/callback");

const {
    getSessionFromRequest
} = require("./auth/session");

const KickCallback = require("./auth/kickCallback");

const YouTubeAuth = require("./auth/youtube");

const YouTubeCallback = require("./auth/youtubeCallback");

const Account = require("./data/account");

const PlatformConnections = require("./data/platformConnections");

const db = require("./database");

function renderKickEmotes(text, emotes = []) {
    if (!text || !Array.isArray(emotes) || emotes.length === 0) {
        return text || "";
    }

    const replacements = [];

    for (const emote of emotes) {
        const id = emote?.emote_id;
        const positions = Array.isArray(emote?.positions)
            ? emote.positions
            : [];

        if (!id) continue;

        for (const position of positions) {
            const start = Number(position?.s);
            const end = Number(position?.e);

            if (!Number.isInteger(start) || !Number.isInteger(end)) {
                continue;
            }

            replacements.push({
                start,
                end,
                id
            });
        }
    }

    replacements.sort((a, b) => b.start - a.start);

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
        this.broadcasters = new Map();
        this.defaultOverlayId = null;

        const PORT =
            process.env.PORT || 3000;

        this.app = express();
const oauthLimiter =
    rateLimit({
        windowMs:
            10 * 60 * 1000,

        max:
            20,

        standardHeaders:
            true,

        legacyHeaders:
            false,

        message: {
            error:
                "Too many OAuth attempts. Please try again later."
        }
    });
        // ============================================================
        // CORS
        // ============================================================

        this.app.use((req, res, next) => {

    const allowedOrigins = [
        "https://www.thebridge4k.com",
        "https://thebridge4k.com",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ];

    const origin =
        req.headers.origin;

    if (allowedOrigins.includes(origin)) {

        res.header(
            "Access-Control-Allow-Origin",
            origin
        );

        res.header(
            "Access-Control-Allow-Credentials",
            "true"
        );

        res.header(
            "Vary",
            "Origin"
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

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});


this.app.use(
    express.json({
        verify: (req, res, buf) => {
            req.rawBody = buf;
        }
    })
);

        // ============================================================
// PUBLIC STATIC FILES
// ============================================================
// Do NOT expose the entire project directory.
// Only serve frontend files that need to be public.
// ============================================================

const publicFiles = [
    "index.html",
    "overlay.html",
    "main.js",
    "settings.js",
    "style.css"
];

for (const file of publicFiles) {
    this.app.get(`/${file}`, (req, res) => {
        res.sendFile(
            path.join(__dirname, file)
        );
    });
}

// Only expose frontend asset directories.
this.app.use(
    "/managers",
    express.static(
        path.join(__dirname, "managers"),
        { dotfiles: "deny" }
    )
);

this.app.use(
    "/renderer",
    express.static(
        path.join(__dirname, "renderer"),
        { dotfiles: "deny" }
    )
);

this.app.use(
    "/assets",
    express.static(
        path.join(__dirname, "assets"),
        { dotfiles: "deny" }
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

        // ============================================================
        // Test
        // ============================================================

        this.app.get(
            "/test",
            (req, res) => {
                res.send(
                    "The Bridge4K relay is working."
                );
            }
        );

        // ============================================================
        // Root Overlay
        // ============================================================

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

        // ============================================================
        // Overlay
        // ============================================================

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

        // ============================================================
        // Account / Overlay Status
        // ============================================================

        this.app.get(
            "/account/status",
            async (req, res) => {

                try {

                    const login =
                        String(
                            req.query.login || ""
                        )
                            .trim()
                            .toLowerCase();

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
                            login
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
                        found: true,
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

        // ============================================================
        // Overlay Settings GET
        // ============================================================

        this.app.get(
    "/overlay/:identifier/settings",
    async (req, res) => {

        try {

            const session =
                getSessionFromRequest(req);

            if (!session) {

                return res
                    .status(401)
                    .json({
                        error:
                            "Authentication required."
                    });

            }

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

            /*
             * ----------------------------------------------------
             * Verify that the authenticated session belongs
             * to the requested Bridge account.
             * ----------------------------------------------------
             */

            if (
                session.overlayId !==
                account.overlayId
            ) {

                console.warn(
                    "⚠️ Unauthorized overlay settings read:",
                    {
                        requestedOverlay:
                            account.overlayId,

                        sessionOverlay:
                            session.overlayId
                    }
                );

                return res
                    .status(403)
                    .json({
                        error:
                            "You are not authorized to view this overlay's settings."
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
                    row?.show_commands === true

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

        // ============================================================
        // Overlay Settings POST
        // ============================================================

        this.app.post(
    "/overlay/:identifier/settings",
    async (req, res) => {

        try {

            const session =
                getSessionFromRequest(req);

            if (!session) {

                return res
                    .status(401)
                    .json({
                        error:
                            "Authentication required."
                    });

            }

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

            if (
                session.overlayId !==
                account.overlayId
            ) {

                console.warn(
                    "⚠️ Unauthorized overlay settings attempt:",
                    {
                        requestedOverlay:
                            account.overlayId,

                        sessionOverlay:
                            session.overlayId
                    }
                );

                return res
                    .status(403)
                    .json({
                        error:
                            "You are not authorized to modify this overlay."
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
                            list.indexOf(bot) ===
                            index
                    )
                    .join(",");

            const showCommands =
                req.body?.showCommands === true;

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

        // ============================================================
        // Debug Overlay
        // ============================================================

        const fs = require("fs");

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

        // ============================================================
// Kick Webhook
// ============================================================

let kickPublicKey = null;

let kickPublicKeyLoadedAt = 0;

const KICK_PUBLIC_KEY_CACHE_TIME =
    60 * 60 * 1000;

const processedKickMessages =
    new Map();


// ============================================================
// Get Kick Public Key
// ============================================================

async function getKickPublicKey() {

    const now =
        Date.now();

    if (
        kickPublicKey &&
        now - kickPublicKeyLoadedAt <
            KICK_PUBLIC_KEY_CACHE_TIME
    ) {
        return kickPublicKey;
    }


    const response =
    await fetch(
        "https://api.kick.com/public/v1/public-key"
    );


if (!response.ok) {

    const errorText =
        await response.text();

    throw new Error(
        `Failed to fetch Kick public key: ${response.status} ${errorText}`
    );

}


const data =
    await response.json();


console.log(
    "🔑 Kick public key loaded successfully."
);


const publicKey =
    data.public_key ||
    data.publicKey ||
    data.data?.public_key ||
    data.data?.publicKey;


if (!publicKey) {

    throw new Error(
        "Kick public key was not returned."
    );

}


kickPublicKey =
    publicKey;

    kickPublicKeyLoadedAt =
        now;


    return kickPublicKey;

}


// ============================================================
// Verify Kick Webhook Signature
// ============================================================

async function verifyKickWebhook(
    req
) {

    const messageId =
        req.headers[
            "kick-event-message-id"
        ];

    const timestamp =
        req.headers[
            "kick-event-message-timestamp"
        ];

    const signature =
        req.headers[
            "kick-event-signature"
        ];


    if (
        !messageId ||
        !timestamp ||
        !signature
    ) {

        console.warn(
            "⚠️ Kick webhook rejected: missing signature headers."
        );

        return false;

    }


    if (!req.rawBody) {

        console.warn(
            "⚠️ Kick webhook rejected: raw body unavailable."
        );

        return false;

    }


    /*
     * --------------------------------------------------------
     * Prevent replay attacks using the webhook timestamp.
     * --------------------------------------------------------
     */

    const timestampMs =
        Date.parse(
            timestamp
        );


    if (
        !Number.isFinite(
            timestampMs
        )
    ) {

        console.warn(
            "⚠️ Kick webhook rejected: invalid timestamp."
        );

        return false;

    }


    const age =
        Math.abs(
            Date.now() -
            timestampMs
        );


    const MAX_WEBHOOK_AGE =
        5 * 60 * 1000;


    if (
        age >
        MAX_WEBHOOK_AGE
    ) {

        console.warn(
            "⚠️ Kick webhook rejected: timestamp too old."
        );

        return false;

    }


    /*
     * --------------------------------------------------------
     * Prevent duplicate delivery of the same event.
     * --------------------------------------------------------
     */

    if (
        processedKickMessages.has(
            messageId
        )
    ) {

        console.warn(
            "⚠️ Duplicate Kick webhook ignored:",
            messageId
        );

        return false;

    }


    const publicKey =
        await getKickPublicKey();


    /*
     * --------------------------------------------------------
     * Kick signs:
     *
     * messageId.timestamp.rawBody
     * --------------------------------------------------------
     */

    const signedPayload =
        Buffer.concat([

            Buffer.from(
                `${messageId}.${timestamp}.`,
                "utf8"
            ),

            req.rawBody

        ]);


    const verifier =
        crypto.createVerify(
            "RSA-SHA256"
        );


    verifier.update(
        signedPayload
    );


    verifier.end();


    const signatureBuffer =
        Buffer.from(
            signature,
            "base64"
        );


    const valid =
        verifier.verify(
            publicKey,
            signatureBuffer
        );


    if (!valid) {

        console.warn(
            "⚠️ Kick webhook rejected: invalid signature."
        );

        return false;

    }


    /*
     * --------------------------------------------------------
     * Signature is valid. Remember the message ID so the
     * same webhook cannot be processed twice.
     * --------------------------------------------------------
     */

    processedKickMessages.set(
        messageId,
        Date.now()
    );


    /*
     * Keep memory bounded.
     */

    if (
        processedKickMessages.size >
        10000
    ) {

        const oldest =
            processedKickMessages
                .entries()
                .next()
                .value;

        if (oldest) {

            processedKickMessages.delete(
                oldest[0]
            );

        }

    }


    return true;

}


// ============================================================
// Kick Webhook Endpoint
// ============================================================

this.app.post(
    "/kick/webhook",
    async (req, res) => {

        try {

            const valid =
                await verifyKickWebhook(
                    req
                );


            if (!valid) {

                return res
                    .status(403)
                    .send(
                        "Forbidden"
                    );

            }


            console.log(
                "📨 Verified Kick Webhook:",
                req.headers[
                    "kick-event-type"
                ]
            );


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
                broadcasterId !== null
            ) {

                connection =
                    await PlatformConnections
                        .loadByPlatformUserId(
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
                    await PlatformConnections
                        .loadByPlatformLogin(
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
                "❌ Kick webhook verification/routing failed:",
                err
            );


            return res.sendStatus(
                500
            );

        }

    }
);

        // ============================================================
        // Twitch Login
        // ============================================================

        this.app.get(
    "/auth/twitch",
    oauthLimiter,
    (req, res) => {

        try {

            const requestedLogin =
                String(
                    req.query.login || ""
                )
                    .trim()
                    .toLowerCase();

            const session =
                getSessionFromRequest(
                    req
                );

            if (requestedLogin) {

                if (!session) {

                    return res
                        .status(401)
                        .send(
                            "You must be logged in to connect Twitch to an existing Bridge account."
                        );

                }

                if (
                    session.login !==
                    requestedLogin
                ) {

                    console.warn(
                        "⚠️ Twitch account-link attempt rejected:",
                        {
                            requestedLogin,
                            sessionLogin:
                                session.login
                        }
                    );

                    return res
                        .status(403)
                        .send(
                            "You are not authorized to connect Twitch to this Bridge account."
                        );

                }

            }

            const result =
                TwitchAuth.buildLoginURL(
                    requestedLogin || null
                );

            return res.redirect(
                result.url
            );

        } catch (err) {

            console.error(
                "❌ Twitch login failed:",
                err
            );

            return res
                .status(500)
                .send(
                    "Twitch login failed."
                );

        }
    }
);

        // ============================================================
        // Twitch OAuth Callback
        // ============================================================

        this.app.get(
    "/auth/twitch/callback",
    oauthLimiter,
    TwitchCallback
);
        // ============================================================
        // YouTube Login
        // ============================================================

        this.app.get(
    "/youtube/login",
    oauthLimiter,
    YouTubeCallback.createLogin
);

        // ============================================================
        // YouTube OAuth Callback
        // ============================================================

        this.app.get(
    "/auth/youtube/callback",
    oauthLimiter,
    YouTubeCallback.callback
);

        // ============================================================
        // Kick Status
        // ============================================================

        this.app.get(
            "/kick/status",
            async (req, res) => {

                try {

                    const login =
                        String(
                            req.query.login || ""
                        ).trim();

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
                            connected: false,
                            error:
                                "Failed to check Kick status."
                        });
                }
            }
        );

        // ============================================================
        // Platform Status
        // ============================================================

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

                    let connection =
                        null;

                    const account =
                        await Account.loadByLogin(
                            login
                        );

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

                    if (!connection) {

                        connection =
                            await PlatformConnections.loadByPlatformLogin(
                                platform,
                                login
                            );
                    }

                    if (!connection) {

                        return res.json({
                            connected: false,
                            platform,
                            displayName: null,
                            login: null
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

        // ============================================================
        // Kick Login
        // ============================================================

        this.app.get(
    "/kick/login",
    oauthLimiter,
    KickCallback.createLogin
);

        // ============================================================
        // Kick Callback
        // ============================================================

        this.app.get(
    "/kick/callback",
    oauthLimiter,
    KickCallback.callback
);
        // ============================================================
        // HTTP + WebSocket Server
        // ============================================================

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

        // ============================================================
        // WebSocket Connections
        // ============================================================

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

                            if (account) {

                                overlayId =
                                    account.overlayId;
                            }
                        }
                    }

                    // ========================================================
                    // IMPORTANT:
                    // Never silently assign a random/default overlay.
                    // Every overlay connection must belong to its account.
                    // ========================================================

                    if (!overlayId) {

                        console.warn(
                            "⚠️ WebSocket rejected: no overlayId"
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
                            "Initialization failed"
                        );

                    } catch (_) {}
                }
            }
        );

        // ============================================================
        // Message Routing
        // ============================================================

        this.on(
            "message",
            (data) => {

                // ========================================================
                // CRITICAL:
                // Messages without an overlayId are NEVER broadcast.
                // ========================================================

                if (!data.overlayId) {

                    console.warn(
                        "⚠️ Dropping message with no overlayId:",
                        data.type || "unknown"
                    );

                    return;
                }

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
    // Command Check
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
    // Default Account
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
    // Send
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
// Export
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