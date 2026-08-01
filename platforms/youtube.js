const { Innertube, Log } = require("youtubei.js");
const bridge = require("../bridge");

require("dotenv").config();

Log.setLevel(Log.Level.ERROR);

let yt = null;
let connected = false;
let checking = false;

async function getYT() {
    if (!yt) {
        yt = await Innertube.create();
    }

    return yt;
}

async function connect() {
    try {

        const youtube = await getYT();

        const channelId = process.env.YOUTUBE_CHANNEL_ID;

        if (!channelId) {
            console.log("❌ YOUTUBE_CHANNEL_ID is missing from .env");
            return false;
        }

        console.log("Looking up channel ID:", channelId);

        const channel = await youtube.getChannel(channelId);

        const featured =
            channel?.current_tab?.content?.contents?.[0]?.contents?.[0];

        if (!featured?.items?.length) {
            console.log("📺 YouTube channel is currently offline.");
            return false;
        }

        const video = featured.items[0];

        if (!video?.content_id) {
            console.log("📺 No live stream found.");
            return false;
        }

        const videoId = video.content_id;

        console.log("✅ Live Video:", videoId);

        const info = await youtube.getInfo(videoId);

        const liveChat = await info.getLiveChat();

        if (!liveChat) {
            console.log("❌ Live chat unavailable.");
            return false;
        }

        console.log("▶ Starting YouTube chat...");

        await liveChat.start();

        console.log("✅ YouTube chat connected!");

        liveChat.addEventListener("chat-update", (event) => {

            for (const action of event.detail) {

                if (action.type !== "AddChatItemAction") continue;

                const msg = action.item;

                bridge.send({
                    type: "message",
                    platform: "youtube",
                    username: msg.author?.name ?? "Unknown",
                    text: msg.message?.text ?? "",
                    badges: msg.author?.badges ?? [],
                    userId: msg.author?.id ?? ""
                });

            }

        });

        return true;

    } catch (err) {

        console.error("YouTube Error:", err);

        return false;

    }
}

async function tryConnect() {

    if (connected || checking) return;

    checking = true;

    try {

        const success = await connect();

        if (success) {

            connected = true;

            console.log("✅ YouTube watcher connected.");

        } else {

            console.log("📺 YouTube offline. Checking again in 60 seconds...");

        }

    } catch (err) {

        console.error("Watcher Error:", err);

    } finally {

        checking = false;

    }

}

async function startWatcher() {

    console.log("🎥 Starting YouTube watcher...");

    await tryConnect();

    setInterval(async () => {

        if (!connected) {

            await tryConnect();

        }

    }, 60000);

}

startWatcher();