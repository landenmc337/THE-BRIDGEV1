const { google } = require("googleapis");
const bridge = require("../bridge");

require("dotenv").config();

const youtube = google.youtube({
    version: "v3",
    auth: process.env.YOUTUBE_API_KEY
});

let liveChatId = null;
let nextPageToken = "";

const channelId = process.env.YOUTUBE_CHANNEL_ID;

if (!channelId) {
    throw new Error("Missing YOUTUBE_CHANNEL_ID in .env");
}

async function connect() {

    try {

        const search = await youtube.search.list({
            part: "snippet",
            channelId,
            eventType: "live",
            type: "video",
            maxResults: 1
        });

        if (!search.data.items.length) {
            console.log("🔴 No YouTube livestream found. Retrying...");
            setTimeout(connect, 30000);
            return;
        }

        const videoId = search.data.items[0].id.videoId;

        const video = await youtube.videos.list({
            part: "liveStreamingDetails",
            id: videoId
        });

        liveChatId = video.data.items[0].liveStreamingDetails.activeLiveChatId;

        nextPageToken = "";

        console.log("✅ Connected to YouTube Chat");

        poll();

    } catch (err) {

        console.error(err);

        setTimeout(connect, 30000);

    }

}

async function poll() {

    try {

        const response = await youtube.liveChatMessages.list({

            liveChatId,

            part: [
                "snippet",
                "authorDetails"
            ],

            pageToken: nextPageToken

        });

        nextPageToken = response.data.nextPageToken;

        for (const message of response.data.items) {

            bridge.send({

                platform: "youtube",

                username: message.authorDetails.displayName,

                color: "#ffffff",

                text: message.snippet.displayMessage,

                badges: {
                    owner: message.authorDetails.isChatOwner,
                    moderator: message.authorDetails.isChatModerator,
                    member: message.authorDetails.isChatSponsor,
                    verified: message.authorDetails.isVerified
                },

                emotes: {},

                channelId: message.authorDetails.channelId

            });

        }

        setTimeout(poll, response.data.pollingIntervalMillis);

    } catch (err) {

        console.error(err);

        setTimeout(connect, 10000);

    }

}

connect();