const express = require("express");
const path = require("path");
const EventEmitter = require("events");
const WebSocket = require("ws");
const http = require("http");
const SevenTVClient = require("./7tv");

class Bridge extends EventEmitter {

    constructor() {

        super();

        this.broadcasterId = null;

        const PORT = process.env.PORT || 3000;

const app = express();

// Serve files from the ChatBridge folder
app.use(express.static(__dirname));
console.log("__dirname:", __dirname);

app.use((req, res, next) => {
    console.log(req.method, req.url);
    next();
});

// Test route
app.get("/test", (req, res) => {
    res.send("Express is working!");
});

// Overlay route
app.get("/", (req, res) => {
    console.log("Serving:", path.join(__dirname, "overlay.html"));
    res.sendFile(path.join(__dirname, "overlay.html"));
});
const fs = require("fs");

app.get("/debug-overlay", (req, res) => {
    res.type("text/plain");
    res.send(fs.readFileSync(path.join(__dirname, "overlay.html"), "utf8"));
});
const server = http.createServer(app);

// Attach WebSocket to the same server
this.wss = new WebSocket.Server({ server });

// Start the server
server.listen(PORT, () => {
    console.log(`RelayIt Bridge running on port ${PORT}`);
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

    console.log("📤 Broadcasting:", data);

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

const sevenTV = new SevenTVClient(205072512);
sevenTV.connect();

module.exports = bridge;

// Load platforms
require("./platforms/twitch");
require("./platforms/youtube");
// Uncomment after YouTube is ready
// require("./platforms/youtube");