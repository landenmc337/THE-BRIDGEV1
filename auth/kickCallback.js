const axios =
    require("axios");

const crypto =
    require("crypto");

const Account =
    require("../data/account");

const PlatformConnections =
    require("../data/platformConnections");

const KickAuth =
    require("./kick");

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
// Store Pending Kick OAuth State
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
// Get Pending Kick OAuth State
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
// Create Kick Login
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
                        "You must be logged in to connect Kick to an existing Bridge account."
                    );

            }


            if (
                session.login !==
                requestedLogin
            ) {

                console.warn(
                    "⚠️ Unauthorized Kick account-link attempt:",
                    {
                        requestedLogin,

                        sessionLogin:
                            session.login
                    }
                );


                return res
                    .status(403)
                    .send(
                        "You are not authorized to connect Kick to this Bridge account."
                    );

            }

        }


        /*
         * ----------------------------------------------------
         * Build signed Kick OAuth URL.
         * ----------------------------------------------------
         */

        const result =
            KickAuth.buildLoginURL(
                requestedLogin ||
                null
            );


        /*
         * ----------------------------------------------------
         * Store PKCE verifier and account information
         * server-side.
         * ----------------------------------------------------
         */

        storeState(
            result.state,
            {
                codeVerifier:
                    result.codeVerifier,

                login:
                    requestedLogin ||
                    null
            }
        );


        console.log(
            "🎯 Starting Kick OAuth for:",
            requestedLogin ||
            "new Bridge account"
        );


        return res.redirect(
            result.url
        );


    } catch (err) {

        console.error(
            "❌ Failed to create Kick login:",
            err
        );


        return res
            .status(500)
            .send(
                "Failed to start Kick login."
            );

    }

}


// ============================================================
// Kick OAuth Callback
// ============================================================

async function callback(
    req,
    res
) {

    console.log(
        "Kick callback query:",
        req.query
    );


    const {
        code,
        state,
        error
    } = req.query;


    // --------------------------------------------------------
    // Kick returned an error
    // --------------------------------------------------------

    if (error) {

        console.error(
            "❌ Kick OAuth Error:",
            error
        );


        return res.send(`
            <h2>The Bridge4K</h2>
            <p>Kick login failed.</p>
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
    // Verify signed state
    // --------------------------------------------------------

    const stateData =
        KickAuth.decodeState(
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
                "Invalid or expired OAuth state."
            );

    }


    /*
     * --------------------------------------------------------
     * State can only be used once.
     * --------------------------------------------------------
     */

    pendingStates.delete(
        state
    );


    // --------------------------------------------------------
    // Verify signed state and server state agree
    // --------------------------------------------------------

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
            "⚠️ Kick OAuth state mismatch."
        );


        return res
            .status(400)
            .send(
                "Invalid OAuth state."
            );

    }


    // --------------------------------------------------------
    // Verify session for existing Bridge account
    // --------------------------------------------------------

    if (stateLogin) {

        const session =
            getSessionFromRequest(
                req
            );


        if (!session) {

            return res
                .status(401)
                .send(
                    "You must be logged in to connect Kick to an existing Bridge account."
                );

        }


        if (
            session.login !==
            stateLogin
        ) {

            console.warn(
                "⚠️ Unauthorized Kick account-link attempt:",
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
                    "You are not authorized to connect Kick to this Bridge account."
                );

        }

    }


    try {

        // ====================================================
        // Exchange Authorization Code
        // ====================================================

        const tokens =
            await KickAuth.exchangeCode(
                code,
                pending.codeVerifier
            );


        console.log(
            "✅ Kick OAuth successful."
        );


        // ====================================================
        // Get Kick User
        // ====================================================

        const userResponse =
            await axios.get(
                "https://api.kick.com/public/v1/users",
                {
                    headers: {
                        Authorization:
                            `Bearer ${tokens.access_token}`
                    }
                }
            );


        const user =
            userResponse.data?.data?.[0];


        if (!user) {

            throw new Error(
                "Kick user could not be found."
            );

        }


        const kickUserId =
            String(
                user.user_id
            );


        const displayName =
            user.name ||
            user.username ||
            "Kick User";


        const kickLogin =
            user.username ||
            displayName;


        console.log(
            "👤 Kick User:",
            displayName
        );


        console.log(
            "🆔 Kick User ID:",
            kickUserId
        );


        // ====================================================
        // Find Existing Bridge Account
        // ====================================================

        let account =
            null;


        /*
         * ----------------------------------------------------
         * Connect Kick to existing Bridge account.
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


            console.log(
                "🔗 Existing Bridge account found."
            );

        }


        // ====================================================
        // Check Existing Kick Connection
        // ====================================================

        if (!account) {

            const existingConnection =
                await PlatformConnections
                    .loadByPlatformUserId(
                        "kick",
                        kickUserId
                    );


            if (existingConnection) {

                const accounts =
                    await Account.loadAll();


                account =
                    accounts.find(
                        item =>
                            item.overlayId ===
                            existingConnection.overlayId
                    ) || null;

            }

        }


        // ====================================================
        // Create Bridge Account If Kick Is First
        // ====================================================

        const overlayId =
            account?.overlayId ||
            "ovl_" +
                crypto.randomBytes(8).toString("hex");


        if (!account) {

            account = {

                overlayId,

                displayName,

                login:
                    kickLogin,

                userId:
                    kickUserId

            };


            console.log(
                "💾 Creating new Bridge account."
            );

        }


        // ====================================================
        // Save Bridge Account
        // ====================================================

        await Account.save({

            overlayId,

            displayName:
                account.displayName ||
                displayName,

            login:
                account.login ||
                kickLogin,

            userId:
                account.userId ||
                kickUserId,

            accessToken:
                account.accessToken ||
                null,

            refreshToken:
                account.refreshToken ||
                null,

            connectedAt:
                Date.now()

        });


        console.log(
            "💾 Bridge account saved."
        );


        console.log(
            "🎯 Bridge Overlay ID:",
            overlayId
        );


        // ====================================================
        // Save Kick Platform Connection
        // ====================================================

        await PlatformConnections.save({

            overlayId,

            platform:
                "kick",

            platformUserId:
                kickUserId,

            displayName,

            login:
                kickLogin,

            accessToken:
                tokens.access_token,

            refreshToken:
                tokens.refresh_token,

            connectedAt:
                Date.now()

        });


        console.log(
            "💾 Kick connection saved."
        );


        // ====================================================
        // Subscribe to Kick Chat
        // ====================================================

        try {

            const subscriptionResponse =
                await axios.post(
                    "https://api.kick.com/public/v1/events/subscriptions",

                    {
                        method:
                            "webhook",

                        events: [
                            {
                                name:
                                    "chat.message.sent",

                                version:
                                    1
                            }
                        ]
                    },

                    {
                        headers: {

                            Authorization:
                                `Bearer ${tokens.access_token}`,

                            "Content-Type":
                                "application/json"

                        }
                    }
                );


            console.log(
                "📡 Kick chat subscription:",
                subscriptionResponse.data
            );


        } catch (
            subscriptionError
        ) {

            console.error(
                "⚠️ Kick chat subscription failed:"
            );


            console.error(
                subscriptionError
                    .response?.data ||
                subscriptionError.message
            );


            /*
             * Don't fail the OAuth connection if the
             * optional subscription fails.
             */

        }


        // ====================================================
        // Create Secure Bridge Session
        // ====================================================

        setSessionCookie(
            res,
            {
                login:
                    account.login ||
                    kickLogin,

                overlayId
            }
        );


        // ====================================================
        // Return To Production Dashboard
        // ====================================================

        const landingUrl =
            process.env.LANDING_URL ||
            "https://www.thebridge4k.com";


        const dashboardLogin =
            account.login ||
            kickLogin;


        const dashboardUrl =
            `${landingUrl}/dashboard?login=${encodeURIComponent(
                dashboardLogin
            )}&overlayId=${encodeURIComponent(
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
            "❌ Kick OAuth Callback Failed"
        );


        if (err.response) {

            console.error(
                "Kick API response:",
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
                "Kick OAuth failed."
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