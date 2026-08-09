const axios = require("axios");
const Account = require("../data/account");
const crypto = require("crypto");

module.exports = async function TwitchCallback(req, res) {

    console.log("Callback query:", req.query);

    const { code, error } = req.query;

    if (error) {

        console.error("❌ Twitch OAuth Error:", error);

        return res.send(`
            <h2>The Bridge4K</h2>
            <p>Twitch login failed.</p>
        `);

    }

    if (!code) {
        return res.status(400).send("Missing authorization code.");
    }

    try {

        const TwitchAuth = require("./twitch");

        const tokens =
            await TwitchAuth.exchangeCode(code);

        console.log("✅ Twitch OAuth successful.");

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
         * Keep the existing overlay ID
         * if this account has already connected.
         */
        const existingAccount =
            await Account.loadByLogin(
                user.login
            );

        const overlayId =
            existingAccount?.overlayId ||
            "ovl_" +
            crypto.randomBytes(8).toString("hex");

        console.log(
            "🎯 Overlay ID:",
            overlayId
        );

        await Account.save({

            overlayId,

            displayName:
                user.display_name,

            login:
                user.login,

            userId:
                user.id,

            accessToken:
                tokens.access_token,

            refreshToken:
                tokens.refresh_token,

            connectedAt:
                Date.now()

        });

        console.log("💾 Account saved.");

        /*
         * Auto-connect Twitch.
         */
        const TwitchPlatform =
            require("../platforms/twitch");

        await TwitchPlatform.initialize();

        console.log("");
        console.log(
            "🎉 Logged Into The Bridge4K"
        );
        console.log("--------------------------------");
        console.log(
            "Display Name:",
            user.display_name
        );
        console.log(
            "Login:",
            user.login
        );
        console.log(
            "User ID:",
            user.id
        );
        console.log(
            "Overlay ID:",
            overlayId
        );
        console.log("--------------------------------");
        console.log("");

        /*
         * Send creator back to the
         * dashboard after OAuth.
         */
        const dashboardUrl =
            `${process.env.LANDING_URL || "http://localhost:3000"}/dashboard?login=${encodeURIComponent(user.login)}`;

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

        res.status(500).send(
            "OAuth failed."
        );

    }

};