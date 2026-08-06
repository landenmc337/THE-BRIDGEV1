const tmi = require("tmi.js");
const axios = require("axios");
const bridge = require("../bridge");
const SevenTVCosmetics = require("../managers/sevenTVCosmetics");
const config = require("../config");

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

    } catch (err) {

        console.error(err.response?.data || err);

    }

});

const DEFAULT_USERNAME_COLORS = [
    "#FF0000",
    "#0000FF",
    "#008000",
    "#B22222",
    "#FF7F50",
    "#9ACD32",
    "#FF4500",
    "#2E8B57",
    "#DAA520",
    "#D2691E",
    "#5F9EA0",
    "#1E90FF",
    "#FF69B4",
    "#8A2BE2",
    "#00FF7F"
];

function getUsernameColor(username, color) {

    if (color) return color;

    let hash = 0;

    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }

    return DEFAULT_USERNAME_COLORS[
        Math.abs(hash) % DEFAULT_USERNAME_COLORS.length
    ];

}

client.on("message", async (channel, tags, message, self) => {

    if (self) return;

    const username = (
        tags.username ||
        tags.login ||
        tags["display-name"] ||
        ""
    ).toLowerCase();

    // ===============================
    // Filters
    // ===============================

    console.log("RAW MESSAGE:", JSON.stringify(message));

const trimmedMessage = message.trim();

console.log("TRIMMED:", JSON.stringify(trimmedMessage));
console.log("STARTS WITH !:", trimmedMessage.startsWith("!"));

if (
    config.filters.hideCommands &&
    trimmedMessage.startsWith(config.filters.commandPrefix)
) {
    console.log("🚫 Hidden Command:", trimmedMessage);
    return;
}

    if (
        config.filters.hiddenUsers.includes(username)
    ) {
        console.log("🚫 Hidden User:", username);
        return;
    }

    // ===============================

    const sevenTV = await SevenTVCosmetics.get(tags["user-id"]);

    bridge.send({

        platform: "twitch",

        username: tags["display-name"],

        color: getUsernameColor(
            tags["display-name"],
            tags.color
        ),

        text: message,

        badges: tags.badges || {},

        emotes: tags.emotes || {},

        channelId: tags["user-id"] || "",

        userId: tags["user-id"] || "",

        sevenTV

    });

});