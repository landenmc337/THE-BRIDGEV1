const EventEmitter = require("events");
const WebSocket = require("ws");
const http = require("http");
const SevenTVClient = require("./7tv");

class Bridge extends EventEmitter {

    constructor() {

        super();

        this.broadcasterId = null;

        const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end("RelayIt Bridge Running");
});

server.listen(PORT, () => {
    console.log(`RelayIt Bridge running on port ${PORT}`);
});

this.wss = new WebSocket.Server({
    server
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