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
// Configuration
// ============================================================

const OFFLINE_CHECK_INTERVAL =
    2 * 60 * 1000;

const RETRY_INTERVAL =
    2 * 60 * 1000;

const QUOTA_COOLDOWN =
    15 * 60 * 1000;

// ============================================================
// Active YouTube Watchers
// ============================================================

const watchers =
    new Map();

// ============================================================
// Account Scheduling
// ============================================================

const nextChecks =
    new Map();

let quotaPausedUntil =
    0;

// ============================================================
// Helpers
// ============================================================

function isQuotaError(err) {

    const message =
        String(
            err?.message ||
            ""
        ).toLowerCase();

    const responseData =
        err?.response?.data ||
        err?.response?.body ||
        err?.errors ||
        "";

    const responseText =
        JSON.stringify(
            responseData
        ).toLowerCase();

    return (
        message.includes(
            "quotaexceeded"
        ) ||
        message.includes(
            "quota exceeded"
        ) ||
        message.includes(
            "quotaExceeded"
        ) ||
        responseText.includes(
            "quotaexceeded"
        )
    );

}

function isParserError(err) {

    const message =
        String(
            err?.message ||
            ""
        ).toLowerCase();

    const stack =
        String(
            err?.stack ||
            ""
        ).toLowerCase();

    return (
        message.includes(
            "parsingerror"
        ) ||
        message.includes(
            "cannot cast"
        ) ||
        stack.includes(
            "parser"
        ) ||
        stack.includes(
            "feedtabbedheader"
        )
    );

}

function getRetryTime(
    overlayId,
    fallback
) {

    return (
        nextChecks.get(
            overlayId
        ) ||
        (
            Date.now() +
            fallback
        )
    );

}

function scheduleCheck(
    account,
    delay
) {

    nextChecks.set(
        account.overlayId,
        Date.now() + delay
    );

}

function clearScheduledCheck(
    overlayId
) {

    nextChecks.delete(
        overlayId
    );

}

function isQuotaPaused() {

    return (
        Date.now() <
        quotaPausedUntil
    );

}

// ============================================================
// Safe YouTube API Error Logging
// ============================================================

function logYouTubeError(
    account,
    err
) {

    if (
        isQuotaError(err)
    ) {

        quotaPausedUntil =
            Date.now() +
            QUOTA_COOLDOWN;

        console.warn(
            `⏸️ YouTube quota reached. Pausing YouTube API checks for ${Math.round(
                QUOTA_COOLDOWN / 60000
            )} minutes.`
        );

        return;

    }

    if (
        isParserError(err)
    ) {

        console.warn(
            `⚠️ YouTube parser response changed for ${account.login}. Skipping this check.`
        );

        return;

    }

    console.error(
        `❌ YouTube error for ${account.login}:`,
        err?.message ||
        err
    );

}

// ============================================================
// Cleanup Watcher
// ============================================================

function removeWatcher(
    overlayId
) {

    const watcher =
        watchers.get(
            overlayId
        );

    if (
        !watcher
    ) {

        return;

    }

    try {

        if (
            watcher.liveChat &&
            typeof watcher.liveChat.stop ===
                "function"
        ) {

            watcher.liveChat.stop();

        }

    } catch {
        // Ignore cleanup errors.
    }

    watchers.delete(
        overlayId
    );

}

// ============================================================
// Connect One YouTube Account
// ============================================================

async function connectAccount(
    account
) {

    const overlayId =
        account.overlayId;

    // --------------------------------------------------------
    // Duplicate watcher protection
    // --------------------------------------------------------

    if (
        watchers.has(
            overlayId
        )
    ) {

        return true;

    }

    // --------------------------------------------------------
    // Quota protection
    // --------------------------------------------------------

    if (
        isQuotaPaused()
    ) {

        return false;

    }

    try {

        const connection =
            await PlatformConnections.load(
                overlayId,
                "youtube"
            );

        if (
            !connection
        ) {

            console.log(
                `📺 No YouTube connection for ${account.login}.`
            );

            scheduleCheck(
                account,
                OFFLINE_CHECK_INTERVAL
            );

            return false;

        }

        if (
            !connection.refreshToken
        ) {

            console.warn(
                `⚠️ YouTube refresh token missing for ${account.login}.`
            );

            scheduleCheck(
                account,
                OFFLINE_CHECK_INTERVAL
            );

            return false;

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
        //
        // Important:
        // Only request active broadcasts.
        // Only ask for one result.
        // ----------------------------------------------------

        const broadcastResponse =
            await youtube.liveBroadcasts.list({

                part: [
                    "snippet",
                    "status"
                ],

                mine: true,

                broadcastStatus:
                    "active",

                maxResults:
                    1

            });

        const broadcasts =
            broadcastResponse?.data?.items ||
            [];

        const liveBroadcast =
            broadcasts[0] ||
            null;

        if (
            !liveBroadcast
        ) {

            console.log(
                `📺 ${account.login} is not currently live.`
            );

            scheduleCheck(
                account,
                OFFLINE_CHECK_INTERVAL
            );

            return false;

        }

        const videoId =
            String(
                liveBroadcast.id ||
                ""
            );

        const liveChatId =
            liveBroadcast
                .snippet
                ?.liveChatId ||
            null;

        if (
            !videoId
        ) {

            console.warn(
                `⚠️ YouTube returned an active broadcast without a video ID for ${account.login}.`
            );

            scheduleCheck(
                account,
                RETRY_INTERVAL
            );

            return false;

        }

        if (
            !liveChatId
        ) {

            console.warn(
                `⚠️ No live chat found for ${account.login}.`
            );

            scheduleCheck(
                account,
                RETRY_INTERVAL
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
        //
        // youtubei.js is only used AFTER the official API
        // confirms the channel is actually live.
        // ----------------------------------------------------

        let yt;

        try {

            yt =
                await Innertube.create();

        } catch (err) {

            logYouTubeError(
                account,
                err
            );

            scheduleCheck(
                account,
                RETRY_INTERVAL
            );

            return false;

        }

        let info;

        try {

            info =
                await yt.getInfo(
                    videoId
                );

        } catch (err) {

            logYouTubeError(
                account,
                err
            );

            scheduleCheck(
                account,
                RETRY_INTERVAL
            );

            return false;

        }

        let liveChat;

        try {

            liveChat =
                await info.getLiveChat();

        } catch (err) {

            logYouTubeError(
                account,
                err
            );

            scheduleCheck(
                account,
                RETRY_INTERVAL
            );

            return false;

        }

        if (
            !liveChat
        ) {

            console.warn(
                `⚠️ YouTube live chat unavailable for ${account.login}.`
            );

            scheduleCheck(
                account,
                RETRY_INTERVAL
            );

            return false;

        }

        console.log(
            `▶ Starting YouTube chat for ${account.login}...`
        );

        // ----------------------------------------------------
        // Store watcher BEFORE starting chat
        //
        // This prevents duplicate watchers if start()
        // triggers events immediately.
        // ----------------------------------------------------

        const watcher = {

            accountLogin:
                account.login,

            overlayId,

            videoId,

            liveChatId,

            liveChat

        };

        watchers.set(
            overlayId,
            watcher
        );

        clearScheduledCheck(
            overlayId
        );

        // ----------------------------------------------------
        // Chat update
        // ----------------------------------------------------

        liveChat.addEventListener(
            "chat-update",
            (event) => {

                try {

                    const actions =
                        event?.detail ||
                        [];

                    for (
                        const action
                        of actions
                    ) {

                        if (
                            action?.type !==
                            "AddChatItemAction"
                        ) {

                            continue;

                        }

                        const msg =
                            action.item;

                        if (
                            !msg
                        ) {

                            continue;

                        }

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

                            channelId:
                                account.userId ??
                                "",

                            timestamp:
                                Date.now()

                        });

                    }

                } catch (err) {

                    console.warn(
                        `⚠️ YouTube chat message processing issue for ${account.login}:`,
                        err?.message ||
                        err
                    );

                }

            }
        );

        // ----------------------------------------------------
        // Chat ended
        // ----------------------------------------------------

        liveChat.addEventListener(
            "end",
            () => {

                console.log(
                    `📴 YouTube chat ended for ${account.login}.`
                );

                removeWatcher(
                    overlayId
                );

                scheduleCheck(
                    account,
                    RETRY_INTERVAL
                );

            }
        );

        // ----------------------------------------------------
        // Chat error
        // ----------------------------------------------------

        liveChat.addEventListener(
            "error",
            (err) => {

                console.warn(
                    `⚠️ YouTube chat error for ${account.login}:`,
                    err?.message ||
                    err
                );

                removeWatcher(
                    overlayId
                );

                scheduleCheck(
                    account,
                    RETRY_INTERVAL
                );

            }
        );

        // ----------------------------------------------------
        // Start chat
        // ----------------------------------------------------

        try {

            const started =
                await liveChat.start();

            if (
                started === false
            ) {

                console.warn(
                    `⚠️ YouTube chat failed to start for ${account.login}.`
                );

                removeWatcher(
                    overlayId
                );

                scheduleCheck(
                    account,
                    RETRY_INTERVAL
                );

                return false;

            }

        } catch (err) {

            removeWatcher(
                overlayId
            );

            logYouTubeError(
                account,
                err
            );

            scheduleCheck(
                account,
                RETRY_INTERVAL
            );

            return false;

        }

        console.log(
            `✅ YouTube chat connected: ${account.login}`
        );

        return true;

    } catch (err) {

        logYouTubeError(
            account,
            err
        );

        removeWatcher(
            overlayId
        );

        scheduleCheck(
            account,
            RETRY_INTERVAL
        );

        return false;

    }

}

// ============================================================
// Check All YouTube Accounts
// ============================================================

async function checkAccounts() {

    if (
        isQuotaPaused()
    ) {

        return;

    }

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

        const now =
            Date.now();

        for (
            const account
            of accounts
        ) {

            const overlayId =
                account.overlayId;

            // ------------------------------------------------
            // Active watcher
            // ------------------------------------------------

            if (
                watchers.has(
                    overlayId
                )
            ) {

                continue;

            }

            // ------------------------------------------------
            // Scheduled check
            // ------------------------------------------------

            const nextCheck =
                nextChecks.get(
                    overlayId
                ) || 0;

            if (
                now <
                nextCheck
            ) {

                continue;

            }

            // ------------------------------------------------
            // Check account
            // ------------------------------------------------

            await connectAccount(
                account
            );

            // ------------------------------------------------
            // Stop immediately if quota was reached
            // ------------------------------------------------

            if (
                isQuotaPaused()
            ) {

                break;

            }

        }

    } catch (err) {

        if (
            isQuotaError(err)
        ) {

            quotaPausedUntil =
                Date.now() +
                QUOTA_COOLDOWN;

            console.warn(
                `⏸️ YouTube quota reached. Pausing checks for ${Math.round(
                    QUOTA_COOLDOWN / 60000
                )} minutes.`
            );

            return;

        }

        console.error(
            "❌ Failed to check YouTube accounts:",
            err?.message ||
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

            try {

                await checkAccounts();

            } catch (err) {

                console.error(
                    "❌ YouTube watcher cycle failed:",
                    err?.message ||
                    err
                );

            }

        },
        30 * 1000
    );

}

// ============================================================
// Start
// ============================================================

startWatcher();

// ============================================================
// Exports
// ============================================================

module.exports = {

    connectAccount,

    checkAccounts

};