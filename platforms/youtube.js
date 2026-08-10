const { Innertube, Log } = require("youtubei.js");

const bridge = require("../bridge");
const Account = require("../data/account");
const PlatformConnections = require("../data/platformConnections");
const YouTubeAuth = require("../auth/youtube");

require("dotenv").config();

Log.setLevel(
    Log.Level.ERROR
);

// ============================================================
// Active YouTube Watchers
// ============================================================

const watchers = new Map();

// ============================================================
// Connect One YouTube Account
// ============================================================

async function connectAccount(account) {

    const overlayId =
        account.overlayId;

    try {

        const connection =
            await PlatformConnections.load(
                overlayId,
                "youtube"
            );

        if (!connection) {

            console.log(
                `📺 No YouTube connection for ${account.login}.`
            );

            return false;

        }

        if (!connection.refreshToken) {

            console.log(
                `❌ YouTube refresh token missing for ${account.login}.`
            );

            return false;

        }

        // ----------------------------------------------------
        // Prevent duplicate watchers
        // ----------------------------------------------------

        if (
            watchers.has(overlayId)
        ) {

            return true;

        }

        console.log(
            `🔍 Checking YouTube for ${account.login}...`
        );

        // ----------------------------------------------------
        // Authenticate using saved OAuth tokens
        // ----------------------------------------------------

        const youtube =
            await YouTubeAuth.getAuthenticatedYouTube({

                access_token:
                    connection.accessToken,

                refresh_token:
                    connection.refreshToken

            });

        // ----------------------------------------------------
        // Find active live broadcast
        // ----------------------------------------------------

        const broadcastResponse =
            await youtube.liveBroadcasts.list({

                part: [
                    "snippet",
                    "contentDetails",
                    "status"
                ],

                mine: true

            });

        const broadcasts =
            broadcastResponse.data.items ||
            [];

        const liveBroadcast =
            broadcasts.find(
                broadcast =>
                    broadcast.status?.lifeCycleStatus ===
                    "live"
            );

        if (!liveBroadcast) {

            console.log(
                `📺 ${account.login} is not currently live.`
            );

            return false;

        }

        const videoId =
            liveBroadcast.id;

        const liveChatId =
            liveBroadcast
                .snippet
                ?.liveChatId;

        if (!liveChatId) {

            console.log(
                `❌ No live chat found for ${account.login}.`
            );

            return false;

        }

        console.log(
            `✅ ${account.login} is live: ${videoId}`
        );

        console.log(
            `💬 Live Chat ID: ${liveChatId}`
        );

        // ----------------------------------------------------
        // Start YouTube chat client
        // ----------------------------------------------------

        const yt =
            await Innertube.create();

        const info =
            await yt.getInfo(
                videoId
            );

        const liveChat =
            await info.getLiveChat();

        if (!liveChat) {

            console.log(
                `❌ YouTube live chat unavailable for ${account.login}.`
            );

            return false;

        }

        console.log(
            `▶ Starting YouTube chat for ${account.login}...`
        );

        await liveChat.start();

        console.log(
            `✅ YouTube chat connected: ${account.login}`
        );

        // ----------------------------------------------------
        // Store watcher
        // ----------------------------------------------------

        watchers.set(
            overlayId,
            {
                accountLogin:
                    account.login,

                overlayId,

                videoId,

                liveChat
            }
        );

        // ----------------------------------------------------
        // Receive chat messages
        // ----------------------------------------------------

        liveChat.addEventListener(
            "chat-update",
            (event) => {

                try {

                    for (
                        const action
                        of event.detail
                    ) {

                        if (
                            action.type !==
                            "AddChatItemAction"
                        ) {

                            continue;

                        }

                        const msg =
                            action.item;

                        bridge.send({

                            type:
                                "message",

                            platform:
                                "youtube",

                            overlayId,

                            username:
                                msg.author?.name ??
                                "Unknown",

                            text:
                                msg.message?.text ??
                                "",

                            badges:
                                msg.author?.badges ??
                                [],

                            userId:
                                msg.author?.id ??
                                "",

                            timestamp:
                                Date.now()

                        });

                    }

                } catch (err) {

                    console.error(
                        `❌ YouTube chat processing error for ${account.login}:`,
                        err
                    );

                }

            }
        );

        return true;

    } catch (err) {

        console.error(
            `❌ YouTube connection failed for ${account.login}:`
        );

        console.error(
            err
        );

        watchers.delete(
            overlayId
        );

        return false;

    }

}

// ============================================================
// Check All YouTube Accounts
// ============================================================

async function checkAccounts() {

    try {

        const accounts =
            await Account.loadAll();

        if (
            accounts.length === 0
        ) {

            console.log(
                "📺 No Bridge accounts found for YouTube."
            );

            return;

        }

        console.log(
            `📋 Checking YouTube for ${accounts.length} Bridge account(s)...`
        );

        for (
            const account
            of accounts
        ) {

            if (
                watchers.has(
                    account.overlayId
                )
            ) {

                continue;

            }

            await connectAccount(
                account
            );

        }

    } catch (err) {

        console.error(
            "❌ Failed to check YouTube accounts:"
        );

        console.error(
            err
        );

    }

}

// ============================================================
// Start YouTube Watcher
// ============================================================

async function startWatcher() {

    console.log(
        "🎥 Starting YouTube multi-account watcher..."
    );

    await checkAccounts();

    setInterval(
        async () => {

            await checkAccounts();

        },
        60000
    );

}

// ============================================================
// Start
// ============================================================

startWatcher();

module.exports = {
    connectAccount,
    checkAccounts
};