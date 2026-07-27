require("dotenv").config();

const axios = require("axios");

let appToken = null;
let expiresAt = 0;

async function getAppToken() {

    if (appToken && Date.now() < expiresAt) {
        return appToken;
    }

    const response = await axios.post(
        "https://id.twitch.tv/oauth2/token",
        null,
        {
            params: {
                client_id: process.env.TWITCH_CLIENT_ID,
                client_secret: process.env.TWITCH_CLIENT_SECRET,
                grant_type: "client_credentials"
            }
        }
    );

    appToken = response.data.access_token;

    expiresAt = Date.now() + (response.data.expires_in - 60) * 1000;

    console.log("✅ Twitch App Token acquired.");

    return appToken;

}

async function getUserId(username) {

    const token = await getAppToken();

    const response = await axios.get(
        "https://api.twitch.tv/helix/users",
        {
            headers: {
                "Client-ID": process.env.TWITCH_CLIENT_ID,
                "Authorization": `Bearer ${token}`
            },
            params: {
                login: username
            }
        }
    );

    if (!response.data.data.length) {
        throw new Error(`Unable to find Twitch user "${username}"`);
    }

    return response.data.data[0].id;

}

module.exports = {
    getAppToken,
    getUserId
};