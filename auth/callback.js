const axios = require("axios");
const Account = require("../data/account");
const PlatformConnections = require("../data/platformConnections");
const crypto = require("crypto");

const {
    setSessionCookie
} = require("./session");

module.exports = async function TwitchCallback(req, res) {

    console.log(
        "Callback query:",
        req.query
    );

    const {
        code,
        error,
        state
    } = req.query;

    if (error) {

        console.error(
            "❌ Twitch OAuth Error:",
            error
        );

        return res.send(`
            <h2>The Bridge4K</h2>
            <p>Twitch login failed.</p>
        `);

    }

    if (!code) {

        return res
            .status(400)
            .send(
                "Missing authorization code."
            );

    }

    if (!state) {

        return res
            .status(400)
            .send(
                "Missing OAuth state."
            );

    }

    try {

        const TwitchAuth =
            require("./twitch");

        const stateData =
            TwitchAuth.decodeState(
                state
            );

        if (!stateData) {

            return res
                .status(400)
                .send(
                    "Invalid OAuth state."
                );

        }

        const tokens =
            await TwitchAuth.exchangeCode(
                code
            );

        console.log(
            "✅ Twitch OAuth successful."
        );

        const userResponse =
            await axios.get(
                "https://api.twitch.tv/helix/users",
                {
                    headers: {
                        "Client-ID":
                            process.env.TWITCH_CLIENT_ID,

                        Authorization:
                            `Bearer ${tokens.access_token}`
                    }
                }
            );

        const user =
            userResponse.data.data[0];

        if (!user) {

            throw new Error(
                "Twitch user could not be found."
            );

        }

        /*
         * ----------------------------------------------------
         * Find an existing Bridge account if Twitch is being
         * connected to an existing creator.
         * ----------------------------------------------------
         */

        let account = null;

        if (stateData.login) {

            account =
                await Account.loadByLogin(
                    stateData.login
                );

        }

        /*
         * ----------------------------------------------------
         * If Twitch is the first platform, create a new
         * Bridge account and overlay.
         * ----------------------------------------------------
         */

        const existingTwitchAccount =
            await Account.loadByLogin(
                user.login
            );

        if (!account && existingTwitchAccount) {

            account =
                existingTwitchAccount;

        }

        const overlayId =
            account?.overlayId ||
            existingTwitchAccount?.overlayId ||
            "ovl_" +
            crypto.randomBytes(8).toString("hex");

        /*
         * ----------------------------------------------------
         * Save / update Bridge account.
         * ----------------------------------------------------
         */

        await Account.save({

            overlayId,

            displayName:
                account?.displayName ||
                user.display_name,

            login:
                account?.login ||
                user.login,

            userId:
                account?.userId ||
                user.id,

            accessToken:
                tokens.access_token,

            refreshToken:
                tokens.refresh_token,

            connectedAt:
                Date.now()

        });

        console.log(
            "💾 Bridge account saved."
        );

        /*
         * ----------------------------------------------------
         * Save Twitch as a platform connection.
         * ----------------------------------------------------
         */

        await PlatformConnections.save({

            overlayId,

            platform:
                "twitch",

            platformUserId:
                String(user.id),

            displayName:
                user.display_name,

            login:
                user.login,

            accessToken:
                tokens.access_token,

            refreshToken:
                tokens.refresh_token,

            connectedAt:
                Date.now()

        });

        console.log(
            "💾 Twitch connection saved."
        );

        /*
         * ----------------------------------------------------
         * Initialize Twitch platform.
         * ----------------------------------------------------
         */

        const TwitchPlatform =
            require("../platforms/twitch");

        await TwitchPlatform.initialize();

        console.log("");
        console.log(
            "🎉 Twitch connected to The Bridge4K"
        );
        console.log(
            "Display Name:",
            user.display_name
        );
        console.log(
            "Login:",
            user.login
        );
        console.log(
            "Overlay ID:",
            overlayId
        );
        console.log("");

        /*
         * ----------------------------------------------------
         * Return to dashboard using the Bridge login.
         * ----------------------------------------------------
         */

        const dashboardLogin =
            account?.login ||
            existingTwitchAccount?.login ||
            user.login;

        /*
         * ----------------------------------------------------
         * Create secure Bridge session.
         * ----------------------------------------------------
         */

        setSessionCookie(
            res,
            {
                login:
                    dashboardLogin,

                overlayId
            }
        );

        const dashboardUrl =
    `${
        process.env.LANDING_URL ||
        "https://www.thebridge4k.com"
    }/dashboard?login=${encodeURIComponent(
                dashboardLogin
            )}&overlayId=${encodeURIComponent(
                overlayId
            )}`;

        return res.redirect(
            dashboardUrl
        );

    } catch (err) {

        console.error(
            "❌ OAuth Callback Failed"
        );

        if (err.response) {

            console.error(
                err.response.data
            );

        } else {

            console.error(err);

        }

        return res
            .status(500)
            .send(
                "OAuth failed."
            );

    }
};