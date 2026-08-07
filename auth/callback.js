const axios = require("axios");
const Account = require("../data/account");

module.exports = async function TwitchCallback(req, res) {

    const { code, error } = req.query;

    if (error) {

        console.error("❌ Twitch OAuth Error:", error);

        return res.send(`
            <h2>The Bridge4K</h2>
            <p>Twitch login failed.</p>
        `);

    }

    try {

        const TwitchAuth = require("./twitch");

        const tokens = await TwitchAuth.exchangeCode(code);

        console.log("✅ OAuth Tokens:");
        console.log(tokens);

        const userResponse = await axios.get(
            "https://api.twitch.tv/helix/users",
            {
                headers: {
                    "Client-ID": process.env.TWITCH_CLIENT_ID,
                    "Authorization": `Bearer ${tokens.access_token}`
                }
            }
        );

        const user = userResponse.data.data[0];
        await Account.save({

    displayName: user.display_name,
    login: user.login,
    userId: user.id,

    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,

    connectedAt: Date.now()

});

console.log("💾 Account saved.");

        console.log("");
        console.log("🎉 Logged Into The Bridge4K");
        console.log("--------------------------------");
        console.log("Display Name:", user.display_name);
        console.log("Login:", user.login);
        console.log("User ID:", user.id);
        console.log("--------------------------------");
        console.log("");

        res.send(`
            <h2>The Bridge4K</h2>
            <p>Twitch connected successfully.</p>
            <p>You can close this window.</p>
        `);

    } catch (err) {

        console.error("❌ OAuth Callback Failed");

        if (err.response) {
            console.error(err.response.data);
        } else {
            console.error(err);
        }

        res.status(500).send("OAuth failed.");

    }

};