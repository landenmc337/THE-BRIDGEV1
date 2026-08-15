require("dotenv").config();

const crypto = require("crypto");
const { google } = require("googleapis");

const REDIRECT_URI =
    process.env.YOUTUBE_REDIRECT_URI ||
    "http://localhost:3847/youtube/callback";

function createOAuthClient() {

    return new google.auth.OAuth2(
        process.env.YOUTUBE_CLIENT_ID,
        process.env.YOUTUBE_CLIENT_SECRET,
        REDIRECT_URI
    );

}

function createState() {

    return crypto
        .randomBytes(32)
        .toString("hex");

}

function buildLoginURL() {

    const state =
        createState();

    const oauth2Client =
        createOAuthClient();

    const url =
        oauth2Client.generateAuthUrl({

            access_type:
                "offline",

            prompt:
                "consent",

            scope: [
                "https://www.googleapis.com/auth/youtube.readonly"
            ],

            state

        });

    return {
        state,
        url
    };

}

async function exchangeCode(code) {

    const oauth2Client =
        createOAuthClient();

    const { tokens } =
        await oauth2Client.getToken(
            code
        );

    return tokens;

}

async function getAuthenticatedYouTube(tokens) {

    const oauth2Client =
        createOAuthClient();

    oauth2Client.setCredentials(
        tokens
    );

    return google.youtube({
        version: "v3",
        auth: oauth2Client
    });

}

module.exports = {
    createOAuthClient,
    buildLoginURL,
    exchangeCode,
    getAuthenticatedYouTube
};