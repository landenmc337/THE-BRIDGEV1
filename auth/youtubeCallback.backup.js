const Account = require("../data/account");
const PlatformConnections = require("../data/platformConnections");
const YouTubeAuth = require("./youtube");

// ============================================================
// Temporary OAuth State Storage
// ============================================================

const pendingStates = new Map();

// ============================================================
// Store Pending YouTube OAuth State
// ============================================================

function storeState(state, data) {

    pendingStates.set(
        state,
        {
            ...data,
            createdAt: Date.now()
        }
    );

}

// ============================================================
// Get Pending YouTube OAuth State
// ============================================================

function getState(state) {

    return pendingStates.get(
        state
    );

}

// ============================================================
// Create YouTube Login
// ============================================================

async function createLogin(req, res) {

    try {

        const login =
            req.query.login;

        if (!login) {

            return res
                .status(400)
                .send(
                    "Missing Bridge account login."
                );

        }

        const account =
            await Account.loadByLogin(
                login.toLowerCase()
            );

        if (!account) {

            return res
                .status(404)
                .send(
                    "Bridge account not found."
                );

        }

        const result =
            YouTubeAuth.buildLoginURL();

        storeState(
            result.state,
            {
                overlayId:
                    account.overlayId,

                login:
                    account.login
            }
        );

        console.log(
            "🎯 Starting YouTube OAuth for:",
            account.login
        );

        console.log(
            "🎯 Overlay ID:",
            account.overlayId
        );

        return res.redirect(
            result.url
        );

    } catch (err) {

        console.error(
            "❌ Failed to create YouTube login:"
        );

        console.error(err);

        return res
            .status(500)
            .send(
                "Failed to start YouTube login."
            );

    }

}

// ============================================================
// YouTube OAuth Callback
// ============================================================

async function callback(req, res) {

    console.log(
        "YouTube callback query:",
        req.query
    );

    const {
        code,
        state,
        error
    } = req.query;

    // --------------------------------------------------------
    // Google returned an error
    // --------------------------------------------------------

    if (error) {

        console.error(
            "❌ YouTube OAuth Error:",
            error
        );

        return res.send(`
            <h2>The Bridge4K</h2>
            <p>YouTube login failed.</p>
        `);

    }

    // --------------------------------------------------------
    // Validate authorization code
    // --------------------------------------------------------

    if (!code) {

        return res
            .status(400)
            .send(
                "Missing authorization code."
            );

    }

    // --------------------------------------------------------
    // Validate OAuth state
    // --------------------------------------------------------

    if (!state) {

        return res
            .status(400)
            .send(
                "Missing OAuth state."
            );

    }

    const pending =
        getState(state);

    if (!pending) {

        return res
            .status(400)
            .send(
                "Invalid or expired OAuth state."
            );

    }

    // Remove state immediately so it
    // cannot be reused.
    pendingStates.delete(
        state
    );

    // --------------------------------------------------------
    // Expire old OAuth attempts
    // --------------------------------------------------------

    const stateAge =
        Date.now() -
        pending.createdAt;

    if (
        stateAge >
        10 * 60 * 1000
    ) {

        return res
            .status(400)
            .send(
                "OAuth session expired. Please try again."
            );

    }

    try {

        // ====================================================
        // Verify Bridge Account
        // ====================================================

        const account =
            await Account.loadByLogin(
                pending.login
            );

        if (!account) {

            throw new Error(
                "Bridge account could not be found."
            );

        }

        // Make sure the account hasn't changed
        // between login and callback.
        if (
            account.overlayId !==
            pending.overlayId
        ) {

            throw new Error(
                "Bridge account overlay mismatch."
            );

        }

        // ====================================================
        // Exchange Authorization Code
        // ====================================================

        const tokens =
            await YouTubeAuth.exchangeCode(
                code
            );

        console.log(
            "✅ YouTube OAuth successful."
        );

        if (!tokens.access_token) {

            throw new Error(
                "YouTube OAuth did not return an access token."
            );

        }

        // ====================================================
        // Get Authenticated YouTube API
        // ====================================================

        const youtube =
            await YouTubeAuth.getAuthenticatedYouTube(
                tokens
            );

        // ====================================================
        // Get Connected YouTube Channel
        // ====================================================

        const channelResponse =
            await youtube.channels.list({

                part: [
                    "snippet",
                    "id"
                ],

                mine: true

            });

        const channels =
            channelResponse.data.items ||
            [];

        const channel =
            channels[0];

        if (!channel) {

            throw new Error(
                "YouTube channel could not be found."
            );

        }

        const channelId =
            String(
                channel.id
            );

        const displayName =
            channel.snippet?.title ||
            "YouTube User";

        const login =
            channelId;

        console.log(
            "📺 YouTube Channel:",
            displayName
        );

        console.log(
            "🆔 YouTube Channel ID:",
            channelId
        );

        console.log(
            "🎯 Bridge Overlay ID:",
            account.overlayId
        );

        // ====================================================
        // Save YouTube Connection
        // ====================================================

        await PlatformConnections.save({

            overlayId:
                account.overlayId,

            platform:
                "youtube",

            platformUserId:
                channelId,

            displayName,

            login,

            accessToken:
                tokens.access_token,

            refreshToken:
                tokens.refresh_token,

            connectedAt:
                Date.now()

        });

        console.log(
            "💾 YouTube connection saved."
        );

        // ====================================================
        // Return To Dashboard
        // ====================================================

        const dashboardUrl =
            `${
                process.env.LANDING_URL ||
                "http://localhost:3000"
            }/dashboard?login=${encodeURIComponent(
                account.login
            )}`;

        return res.redirect(
            dashboardUrl
        );

    } catch (err) {

        console.error(
            "❌ YouTube OAuth Callback Failed"
        );

        if (err.response) {

            console.error(
                "YouTube API response:",
                err.response.data
            );

        } else {

            console.error(
                err
            );

        }

        return res
            .status(500)
            .send(
                "YouTube OAuth failed."
            );

    }

}

// ============================================================
// Exports
// ============================================================

module.exports = {
    createLogin,
    callback
};