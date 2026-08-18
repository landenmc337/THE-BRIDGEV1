require("dotenv").config();

const crypto = require("crypto");
const { google } = require("googleapis");

const REDIRECT_URI =
    process.env.YOUTUBE_REDIRECT_URI;

if (!REDIRECT_URI) {
    throw new Error(
        "YOUTUBE_REDIRECT_URI is not configured."
    );
}


// ============================================================
// Create OAuth Client
// ============================================================

function createOAuthClient() {

    return new google.auth.OAuth2(
        process.env.YOUTUBE_CLIENT_ID,
        process.env.YOUTUBE_CLIENT_SECRET,
        REDIRECT_URI
    );

}


// ============================================================
// Create Signed OAuth State
// ============================================================

function createState(login = null) {

    const payload = {

        nonce:
            crypto.randomBytes(32).toString("hex"),

        login:
            login || null,

        createdAt:
            Date.now()

    };


    const data =
        Buffer
            .from(
                JSON.stringify(payload)
            )
            .toString("base64url");


    const signature =
        crypto
            .createHmac(
                "sha256",
                process.env.YOUTUBE_CLIENT_SECRET
            )
            .update(data)
            .digest("base64url");


    return `${data}.${signature}`;

}


// ============================================================
// Decode + Verify OAuth State
// ============================================================

function decodeState(state) {

    if (!state) {
        return null;
    }


    const parts =
        state.split(".");


    if (parts.length !== 2) {
        return null;
    }


    const [
        data,
        signature
    ] = parts;


    const expectedSignature =
        crypto
            .createHmac(
                "sha256",
                process.env.YOUTUBE_CLIENT_SECRET
            )
            .update(data)
            .digest("base64url");


    if (
        signature.length !==
        expectedSignature.length
    ) {
        return null;
    }


    let signaturesMatch;

    try {

        signaturesMatch =
            crypto.timingSafeEqual(
                Buffer.from(signature),
                Buffer.from(
                    expectedSignature
                )
            );

    } catch {

        return null;

    }


    if (!signaturesMatch) {
        return null;
    }


    try {

        const stateData =
            JSON.parse(
                Buffer
                    .from(
                        data,
                        "base64url"
                    )
                    .toString("utf8")
            );


        const createdAt =
            Number(
                stateData.createdAt
            );


        const TEN_MINUTES =
            10 * 60 * 1000;


        if (
            !Number.isFinite(
                createdAt
            ) ||
            Date.now() - createdAt >
                TEN_MINUTES ||
            Date.now() - createdAt < 0
        ) {

            console.warn(
                "⚠️ YouTube OAuth state expired."
            );

            return null;

        }


        return stateData;


    } catch {

        return null;

    }

}


// ============================================================
// Build YouTube Login URL
// ============================================================

function buildLoginURL(
    login = null
) {

    const state =
        createState(
            login
        );


    const oauth2Client =
        createOAuthClient();


    const url =
        oauth2Client.generateAuthUrl({

            access_type:
                "offline",

            prompt:
                "select_account consent",

            include_granted_scopes:
                true,

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


// ============================================================
// Exchange Authorization Code
// ============================================================

async function exchangeCode(
    code
) {

    const oauth2Client =
        createOAuthClient();


    const { tokens } =
        await oauth2Client.getToken(
            code
        );


    return tokens;

}


// ============================================================
// Get Authenticated YouTube API
// ============================================================

async function getAuthenticatedYouTube(
    tokens
) {

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


// ============================================================
// Exports
// ============================================================

module.exports = {

    createOAuthClient,

    buildLoginURL,

    decodeState,

    exchangeCode,

    getAuthenticatedYouTube

};