const { Innertube, Log } = require("youtubei.js");
const bridge = require("../bridge");

require("dotenv").config();

Log.setLevel(Log.Level.ERROR);

let yt = null;

async function getYT() {
    if (!yt) {
        yt = await Innertube.create();
    }

    return yt;
}

async function connect() {
    try {
        const youtube = await getYT();

        console.log("Looking up:", process.env.YOUTUBE_CHANNEL);

        const endpoint = await youtube.resolveURL(process.env.YOUTUBE_CHANNEL);
        const browseId = endpoint.payload.browseId;

        const channel = await youtube.getChannel(browseId);

        const featured = channel.current_tab.content.contents[0].contents[0];
        const video = featured.items[0];

        const videoId = video.content_id;

        console.log("Live Video:", videoId);

        const info = await youtube.getInfo(videoId);

        const liveChat = await info.getLiveChat();

        console.log("Starting chat...");

        await liveChat.start();

        console.log("Chat started!");

        liveChat.addEventListener("chat-update", (event) => {
            for (const action of event.detail) {
                if (action.type !== "AddChatItemAction")
                    continue;

                const msg = action.item;

                // Debug the message object
                console.dir(msg, { depth: 4 });
                console.log("Sending to bridge:", {
    username: msg.author.name,
    text: msg.message.text
});

                bridge.send({
    type: "message",
    platform: "youtube",

    username: msg.author.name,

    text: msg.message.text,

    badges: msg.author.badges,

    userId: msg.author.id
});
            }
        });

    } catch (err) {
        console.error(err);
    }
}

connect();