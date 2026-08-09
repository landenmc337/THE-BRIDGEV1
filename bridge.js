const express = require("express");
const path = require("path");
const EventEmitter = require("events");
const WebSocket = require("ws");
const http = require("http");

const SevenTVClient = require("./7tv");
const TwitchAuth = require("./auth/twitch");
const TwitchCallback = require("./auth/callback");
const Account = require("./data/account");
const db = require("./database");

class Bridge extends EventEmitter {

    constructor() {

        super();

        this.broadcasterId = null;
        this.broadcasters = new Map();
        this.defaultOverlayId = null;

        const PORT = process.env.PORT || 3000;

        this.app = express();

        this.app.use(express.static(__dirname));

        console.log("__dirname:", __dirname);

        this.app.use((req, res, next) => {
            console.log(req.method, req.url);
            next();
        });

        // ============================
        // Test Route
        // ============================

        this.app.get("/test", (req, res) => {
            res.send("Express is working!");
        });

        // ============================
        // Overlay
        // ============================

        this.app.get("/", (req, res) => {
            res.sendFile(path.join(__dirname, "overlay.html"));
        });
        this.app.get("/overlay/:login", async (req, res) => {

    try {

        const login = req.params.login.toLowerCase();

        const account =
            await Account.loadByLogin(login);

        if (!account) {

            return res.status(404).send(`
                <h2>The Bridge4K</h2>
                <p>Overlay not found.</p>
            `);

        }

        res.sendFile(
            path.join(__dirname, "overlay.html")
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

});

        const fs = require("fs");

        this.app.get("/debug-overlay", (req, res) => {

            res.type("text/plain");

            res.send(
                fs.readFileSync(
                    path.join(__dirname, "overlay.html"),
                    "utf8"
                )
            );

        });

        // ============================
        // Twitch Login
        // ============================

        this.app.get("/auth/twitch", (req, res) => {

            const result = TwitchAuth.buildLoginURL();

            res.redirect(result.url);

        });

        // ============================
        // Twitch OAuth Callback
        // ============================

        this.app.get(
            "/auth/twitch/callback",
            TwitchCallback
        );

        // ============================

        const server = http.createServer(this.app);

        this.wss = new WebSocket.Server({ server });

        server.listen(PORT, () => {
            console.log(
                `The Bridge4K running on port ${PORT}`
            );
        });

        // ============================
        // WebSocket Connections
        // ============================

        this.wss.on("connection", async (ws, req) => {

            console.log("🖥 Overlay Connected");

            try {

                const url = new URL(
                    req.url,
                    `http://${req.headers.host || "localhost"}`
                );

                let overlayId =
    url.searchParams.get("overlayId");

if (!overlayId) {

    const match =
        url.pathname.match(/^\/overlay\/([^/]+)$/);

    if (match) {

        const login =
            match[1].toLowerCase();

        const account =
            await Account.loadByLogin(login);

        if (account) {
            overlayId = account.overlayId;
        }

    }

}

                // Keep the existing root overlay working.
                if (!overlayId) {
                    overlayId = this.defaultOverlayId;
                }

                ws.overlayId = overlayId;

                console.log(
                    "🎯 Overlay ID:",
                    overlayId || "none"
                );

                if (overlayId) {

                    const broadcasterId =
                        this.broadcasters.get(overlayId);

                    if (broadcasterId) {

                        ws.send(JSON.stringify({
                            type: "init",
                            userId: broadcasterId,
                            overlayId
                        }));

                    }

                }

            } catch (err) {

                console.error(
                    "❌ WebSocket initialization failed:",
                    err
                );

            }

        });

        // ============================
        // Message Routing
        // ============================

        this.on("message", (data) => {

            const payload = JSON.stringify(data);

            this.wss.clients.forEach((client) => {

                if (
                    client.readyState !== WebSocket.OPEN
                ) {
                    return;
                }

                // Only send the message to the
                // overlay belonging to this account.
                if (
                    data.overlayId &&
                    client.overlayId !== data.overlayId
                ) {
                    return;
                }

                client.send(payload);

            });

        });

        // ============================
        // Load Default Account
        // ============================

        this.loadDefaultAccount();

    }

    async loadDefaultAccount() {

        try {

            const accounts =
                await Account.loadAll();

            if (accounts.length > 0) {

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

    send(data) {

        this.emit("message", {

            type: data.type,

            platform:
                data.platform,

            overlayId:
                data.overlayId || null,

            username:
                data.username,

            color:
                data.color || "#ffffff",

            text:
                data.text,

            badges:
                data.badges || {},

            emotes:
                data.emotes || {},

            channelId:
                data.channelId || "",

            userId:
                data.userId || "",

            sevenTV:
                data.sevenTV || {
                    paint: null,
                    badge: null,
                    effects: [],
                    raw: null
                },

            timestamp:
                Date.now()

        });

    }

    setBroadcasterId(id, overlayId = null) {

        if (overlayId) {

            this.broadcasters.set(
                overlayId,
                id
            );

            console.log(
                `📺 Broadcaster mapped: ${overlayId} → ${id}`
            );

        } else {

            // Legacy fallback for the current account.
            this.broadcasterId = id;

        }

        this.send({

            type: "init",

            userId: id,

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
            await db.query("SELECT NOW()");

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

        console.error(err);

    }

})();

// ============================
// Bridge
// ============================

const bridge = new Bridge();

bridge.loadDefaultAccount();

// ============================
// 7TV
// ============================

const sevenTV =
    new SevenTVClient(205072512);

sevenTV.connect();

module.exports = bridge;

// ============================
// Load Platforms
// ============================

require("./platforms/twitch");
require("./platforms/youtube");