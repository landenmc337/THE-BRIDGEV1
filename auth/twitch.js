require("dotenv").config();

const crypto = require("crypto");
const axios = require("axios");

function createState() {
    return crypto.randomBytes(32).toString("hex");
}

function buildLoginURL() {

    const state = createState();

    const params = new URLSearchParams({
        client_id: process.env.TWITCH_CLIENT_ID,
        redirect_uri: process.env.TWITCH_REDIRECT_URI,
        response_type: "code",
        scope: "chat:read chat:edit user:read:email",
        force_verify: "false",
        state
    });

    return {
        state,
        url: "https://id.twitch.tv/oauth2/authorize?" + params.toString()
    };

}

async function exchangeCode(code) {

    const response = await axios.post(
        "https://id.twitch.tv/oauth2/token",
        null,
        {
            params: {
                client_id: process.env.TWITCH_CLIENT_ID,
                client_secret: process.env.TWITCH_CLIENT_SECRET,
                code,
                grant_type: "authorization_code",
                redirect_uri: process.env.TWITCH_REDIRECT_URI
            }
        }
    );

    return response.data;

}

module.exports = {
    buildLoginURL,
    exchangeCode
};