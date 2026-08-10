const axios = require("axios");
const Account = require("../data/account");
const PlatformConnections = require("../data/platformConnections");
const KickAuth = require("./kick");


// ============================================================
// Temporary OAuth State Storage
// ============================================================

const pendingStates = new Map();


// ============================================================
// Create Kick Login
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


        // Verify that this is a real Bridge account.
        const account =
            await Account.loadByLogin(
                login
            );

        if (!account) {

            return res
                .status(404)
                .send(
                    "Bridge account not found."
                );

        }


        const result =
            KickAuth.buildLoginURL();


        pendingStates.set(
            result.state,
            {
                codeVerifier:
                    result.codeVerifier,

                overlayId:
                    account.overlayId,

                login:
                    account.login,

                createdAt:
                    Date.now()
            }
        );


        console.log(
            "🎯 Starting Kick OAuth for:",
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
            "❌ Failed to create Kick login:"
        );

        console.error(err);

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

async function callback(req, res) {

    console.log(
        "Kick callback query:",
        req.query
    );


    const {
        code,
        state,
        error
    } = req.query;


    // ----------------------------------------------------------
    // Kick returned an error
    // ----------------------------------------------------------

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


    // ----------------------------------------------------------
    // Validate authorization code
    // ----------------------------------------------------------

    if (!code) {

        return res
            .status(400)
            .send(
                "Missing authorization code."
            );

    }


    // ----------------------------------------------------------
    // Validate OAuth state
    // ----------------------------------------------------------

    if (!state) {

        return res
            .status(400)
            .send(
                "Missing OAuth state."
            );

    }


    const pending =
        pendingStates.get(
            state
        );


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


    // ----------------------------------------------------------
    // Expire old OAuth attempts
    // ----------------------------------------------------------

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

        // ======================================================
        // Verify Bridge Account
        // ======================================================

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


        // ======================================================
        // Exchange Authorization Code
        // ======================================================

        const tokens =
            await KickAuth.exchangeCode(
                code,
                pending.codeVerifier
            );


        console.log(
            "✅ Kick OAuth successful."
        );


        // ======================================================
        // Get Authenticated Kick User
        // ======================================================

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


        const users =
            userResponse.data?.data ||
            [];


        const user =
            users[0];


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


        const login =
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


        console.log(
            "🎯 Bridge Overlay ID:",
            account.overlayId
        );


        // ======================================================
        // Save Kick Connection
        // ======================================================

        await PlatformConnections.save({

            overlayId:
                account.overlayId,

            platform:
                "kick",

            platformUserId:
                kickUserId,

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
            "💾 Kick connection saved."
        );
        
const subscriptionResponse = await axios.post(
    "https://api.kick.com/public/v1/events/subscriptions",
    {
        method: "webhook",
        events: [
            {
                name: "chat.message.sent",
                version: 1
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

        // ======================================================
        // Return To Dashboard
        // ======================================================

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