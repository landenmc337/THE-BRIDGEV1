const express = require("express");
const path = require("path");
const EventEmitter = require("events");
const WebSocket = require("ws");
const http = require("http");

const SevenTVClient = require("./7tv");
const TwitchAuth = require("./auth/twitch");
const TwitchCallback = require("./auth/callback");

class Bridge extends EventEmitter {

    constructor() {

        super();

        this.broadcasterId = null;

        const PORT = process.env.PORT || 3000;

        this.app = express();

        // Serve files
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

        this.app.get("/auth/twitch/callback", TwitchCallback);

        // ============================

        const server = http.createServer(this.app);

        this.wss = new WebSocket.Server({ server });

        server.listen(PORT, () => {
            console.log(`The Bridge4K running on port ${PORT}`);
        });

        this.wss.on("connection", (ws) => {

            console.log("🖥 Overlay Connected");

            if (this.broadcasterId) {

                ws.send(JSON.stringify({
                    type: "init",
                    userId: this.broadcasterId
                }));

            }

        });

        this.on("message", (data) => {

            const payload = JSON.stringify(data);

            this.wss.clients.forEach((client) => {

                if (client.readyState === WebSocket.OPEN) {
                    client.send(payload);
                }

            });

        });

    }

    send(data) {

        this.emit("message", {

            type: data.type,
            platform: data.platform,
            username: data.username,
            color: data.color || "#ffffff",
            text: data.text,
            badges: data.badges || {},
            emotes: data.emotes || {},
            channelId: data.channelId || "",
            userId: data.userId || "",

            sevenTV: data.sevenTV || {
                paint: null,
                badge: null,
                effects: [],
                raw: null
            },

            timestamp: Date.now()

        });

    }

    setBroadcasterId(id) {

        this.broadcasterId = id;

        this.send({
            type: "init",
            userId: id
        });

    }

}

const bridge = new Bridge();

account.userId
sevenTV.connect();

module.exports = bridge;

// Load Platforms
require("./platforms/twitch");
require("./platforms/youtube");