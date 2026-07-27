const WebSocket = require("ws");

class SevenTVClient {
    constructor(channelId) {
        this.channelId = channelId;
        this.ws = null;
        this.subscribed = false;
    }

    connect() {
        this.ws = new WebSocket("wss://events.7tv.io/v3");

        this.ws.on("open", () => {
            console.log("7TV connected");
        });

        this.ws.on("message", (data) => {
            let packet;

            try {
                packet = JSON.parse(data.toString());
            } catch {
                return;
            }

            // Subscribe after Hello
            if (packet.op === 1 && !this.subscribed) {
                this.subscribed = true;

                const condition = {
                    ctx: "channel",
                    platform: "TWITCH",
                    id: String(this.channelId)
                };

                // Keep entitlement events if you still use them
                this.ws.send(JSON.stringify({
                    op: 35,
                    d: {
                        type: "entitlement.create",
                        condition
                    }
                }));

                this.ws.send(JSON.stringify({
                    op: 35,
                    d: {
                        type: "entitlement.delete",
                        condition
                    }
                }));
            }

            // Uncomment while debugging if needed
            // console.dir(packet, { depth: null });
        });

        this.ws.on("close", () => {
            console.log("7TV disconnected");
        });

        this.ws.on("error", (err) => {
            console.error(err);
        });
    }
}

module.exports = SevenTVClient;