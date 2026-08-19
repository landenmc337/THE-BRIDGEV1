const Account =
    require("../data/account");

const PlatformConnections =
    require("../data/platformConnections");

const YouTubeAuth =
    require("./youtube");

const crypto =
    require("crypto");

const {
    getSessionFromRequest,
    setSessionCookie
} = require("./session");


// ============================================================
// Temporary OAuth State Storage
// ============================================================

const pendingStates =
    new Map();


// ============================================================
// Store Pending YouTube OAuth State
// ============================================================

function storeState(
    state,
    data
) {

    pendingStates.set(
        state,
        {
            ...data,

            createdAt:
                Date.now()
        }
    );

}


// ============================================================
// Get Pending YouTube OAuth State
// ============================================================

function getState(
    state
) {

    const pending =
        pendingStates.get(
            state
        );

    if (!pending) {
        return null;
    }

    const stateAge =
        Date.now() -
        pending.createdAt;

    if (
        stateAge >
        10 * 60 * 1000
    ) {

        pendingStates.delete(
            state
        );

        return null;

    }

    return pending;

}


// ============================================================
// Create YouTube Login
// ============================================================

async function createLogin(
    req,
    res
) {

    try {

        const requestedLogin =
            String(
                req.query.login || ""
            )
                .trim()
                .toLowerCase();


        const session =
            getSessionFromRequest(
                req
            );


        /*
         * ----------------------------------------------------
         * Existing Bridge account linking requires an
         * authenticated session belonging to that account.
         * ----------------------------------------------------
         */

        if (requestedLogin) {

            if (!session) {

                return res
                    .status(401)
                    .send(
                        "You must be logged in to connect YouTube to an existing Bridge account."
                    );

            }


            if (
                session.login !==
                requestedLogin
            ) {

                console.warn(
                    "⚠️ Unauthorized YouTube account-link attempt:",
                    {
                        requestedLogin,

                        sessionLogin:
                            session.login
                    }
                );


                return res
                    .status(403)
                    .send(
                        "You are not authorized to connect YouTube to this Bridge account."
                    );

            }

        }


        /*
         * ----------------------------------------------------
         * Build signed YouTube OAuth URL.
         * ----------------------------------------------------
         */

        const result =
            YouTubeAuth.buildLoginURL(
                requestedLogin ||
                null
            );


        /*
         * ----------------------------------------------------
         * Store temporary state as an additional one-time
         * server-side protection.
         * ----------------------------------------------------
         */

        storeState(
            result.state,
            {
                login:
                    requestedLogin ||
                    null
            }
        );


        console.log(
            "🎯 Starting YouTube OAuth"
        );


        if (requestedLogin) {

            console.log(
                "🎯 Existing Bridge login:",
                requestedLogin
            );

        } else {

            console.log(
                "🎯 YouTube will create a new Bridge account"
            );

        }


        return res.redirect(
            result.url
        );


    } catch (err) {

        console.error(
            "❌ Failed to create YouTube login:"
        );

        console.error(
            err
        );


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

async function callback(
    req,
    res
) {

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


    // --------------------------------------------------------
    // Decode + verify signed state
    // --------------------------------------------------------

    const stateData =
        YouTubeAuth.decodeState(
            state
        );


    if (!stateData) {

        return res
            .status(400)
            .send(
                "Invalid or expired OAuth state."
            );

    }


    // --------------------------------------------------------
    // Verify temporary server-side state
    // --------------------------------------------------------

    const pending =
        getState(
            state
        );


    if (!pending) {

        return res
            .status(400)
            .send(
                "Invalid or expired OAuth session."
            );

    }


    /*
     * --------------------------------------------------------
     * Remove state immediately so it cannot be reused.
     * --------------------------------------------------------
     */

    pendingStates.delete(
        state
    );


    /*
     * --------------------------------------------------------
     * Make sure the signed state and server-side state
     * agree about the Bridge account being connected.
     * --------------------------------------------------------
     */

    const stateLogin =
        stateData.login
            ? String(
                stateData.login
            )
                .trim()
                .toLowerCase()
            : null;

    const pendingLogin =
        pending.login
            ? String(
                pending.login
            )
                .trim()
                .toLowerCase()
            : null;


    if (
        stateLogin !==
        pendingLogin
    ) {

        console.warn(
            "⚠️ YouTube OAuth state mismatch."
        );


        return res
            .status(400)
            .send(
                "Invalid OAuth state."
            );

    }


    /*
     * --------------------------------------------------------
     * If connecting YouTube to an existing Bridge account,
     * verify that the authenticated Bridge session owns it.
     * --------------------------------------------------------
     */

    if (stateLogin) {

        const session =
            getSessionFromRequest(
                req
            );


        if (!session) {

            return res
                .status(401)
                .send(
                    "You must be logged in to connect YouTube to an existing Bridge account."
                );

        }


        if (
            session.login !==
            stateLogin
        ) {

            console.warn(
                "⚠️ Unauthorized YouTube account-link attempt:",
                {
                    requestedLogin:
                        stateLogin,

                    sessionLogin:
                        session.login
                }
            );


            return res
                .status(403)
                .send(
                    "You are not authorized to connect YouTube to this Bridge account."
                );

        }

    }


    try {

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

                mine:
                    true

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


        const youtubeLogin =
            channelId;


        console.log(
            "📺 YouTube Channel:",
            displayName
        );


        console.log(
            "🆔 YouTube Channel ID:",
            channelId
        );


        // ====================================================
        // Find Existing Bridge Account
        // ====================================================

        let account =
            null;


        /*
         * ----------------------------------------------------
         * If a creator already has a Bridge account,
         * attach YouTube to that existing overlay.
         * ----------------------------------------------------
         */

        if (stateLogin) {

            account =
                await Account.loadByLogin(
                    stateLogin
                );


            if (!account) {

                throw new Error(
                    "Bridge account could not be found."
                );

            }

        }


        /*
         * ----------------------------------------------------
         * If YouTube is already connected to a Bridge
         * account, reuse that account.
         * ----------------------------------------------------
         */

        if (!account) {

            const existingYouTube =
                await PlatformConnections
                    .loadByPlatformUserId(
                        "youtube",
                        channelId
                    );


            if (existingYouTube) {

                account =
                    await Account.loadByOverlayId(
                        existingYouTube.overlayId
                    );

            }

        }


        // ====================================================
        // Create Bridge Account If YouTube Is First
        // ====================================================

        const overlayId =
            account?.overlayId ||
            "ovl_" +
            crypto.randomBytes(8).toString("hex");


        const bridgeLogin =
            account?.login ||
            youtubeLogin;


        const bridgeDisplayName =
            account?.displayName ||
            displayName;


        if (!account) {

            await Account.save({

                overlayId,

                displayName:
                    bridgeDisplayName,

                login:
                    bridgeLogin,

                userId:
                    channelId,

                accessToken:
                    tokens.access_token,

                refreshToken:
                    tokens.refresh_token,

                connectedAt:
                    Date.now()

            });


            console.log(
                "💾 New Bridge account created."
            );

        } else {

            console.log(
                "🔗 Existing Bridge account found."
            );

        }


        console.log(
            "🎯 Bridge Overlay ID:",
            overlayId
        );


        // ====================================================
        // Save YouTube Connection
        // ====================================================

        await PlatformConnections.save({

            overlayId,

            platform:
                "youtube",

            platformUserId:
                channelId,

            displayName,

            login:
                youtubeLogin,

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
        // Create Secure Bridge Session
        // ====================================================

        setSessionCookie(
            res,
            {
                login:
                    bridgeLogin,

                overlayId
            }
        );


        // ====================================================
        // Return To Dashboard
        // ====================================================

        const dashboardUrl =
    `${
        process.env.LANDING_URL ||
        "https://www.thebridge4k.com"
    }/dashboard?login=${encodeURIComponent(
                overlayId
            )}`;


        console.log(
            "➡️ Returning to dashboard:",
            dashboardUrl
        );


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