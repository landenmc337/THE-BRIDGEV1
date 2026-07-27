const tmi = require("tmi.js");
const axios = require("axios");
const bridge = require("../bridge");
const SevenTVCosmetics = require("../managers/sevenTVCosmetics");

require("dotenv").config();

const client = new tmi.Client({
    identity: {
        username: process.env.TWITCH_BOT_USERNAME,
        password: process.env.TWITCH_OAUTH
    },
    channels: [
        process.env.TWITCH_CHANNEL
    ]
});

client.connect().catch(console.error);

client.on("connected", async () => {

    console.log(`✅ Connected to Twitch: ${process.env.TWITCH_CHANNEL}`);

    try {

        const token = await axios.post(
            "https://id.twitch.tv/oauth2/token",
            null,
            {
                params: {
                    client_id: process.env.TWITCH_CLIENT_ID,
                    client_secret: process.env.TWITCH_CLIENT_SECRET,
                    grant_type: "client_credentials"
                }
            }
        );

        const accessToken = token.data.access_token;

        const user = await axios.get(
            "https://api.twitch.tv/helix/users",
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Client-Id": process.env.TWITCH_CLIENT_ID
                },
                params: {
                    login: process.env.TWITCH_CHANNEL
                }
            }
        );

        const broadcasterId = user.data.data[0].id;

        console.log("📺 Broadcaster:", broadcasterId);

        bridge.setBroadcasterId(broadcasterId);

    }
    catch (err) {

        console.error(err.response?.data || err);

    }

});

client.on("message", async (channel, tags, message, self) => {

    if (self) return;

    const sevenTV = await SevenTVCosmetics.get(tags["user-id"]);
    console.log(JSON.stringify(sevenTV, null, 2));
    bridge.send({

        platform: "twitch",

        username: tags["display-name"],

        color: tags.color || "#ffffff",

        text: message,

        badges: tags.badges || {},

        emotes: tags.emotes || {},

        channelId: tags["user-id"] || "",

        userId: tags["user-id"] || "",

        sevenTV

    });

});