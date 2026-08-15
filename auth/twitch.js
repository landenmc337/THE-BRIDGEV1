require("dotenv").config();

const crypto = require("crypto");
const axios = require("axios");


// ============================================================
// Create Signed OAuth State
// ============================================================

function createState(login = null) {

    const payload = {

        nonce:
            crypto.randomBytes(32).toString("hex"),

        login:
            login || null

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
                process.env.TWITCH_CLIENT_SECRET
            )
            .update(data)
            .digest("base64url");


    return `${data}.${signature}`;
}


// ============================================================
// Build Twitch Login URL
// ============================================================

function buildLoginURL(login = null) {

    const state =
        createState(login);


    const params =
        new URLSearchParams({

            client_id:
                process.env.TWITCH_CLIENT_ID,

            redirect_uri:
                process.env.TWITCH_REDIRECT_URI,

            response_type:
                "code",

            scope:
                "chat:read chat:edit user:read:email",

            force_verify:
                "false",

            state

        });


    return {

        state,

        url:
            "https://id.twitch.tv/oauth2/authorize?" +
            params.toString()

    };
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
                process.env.TWITCH_CLIENT_SECRET
            )
            .update(data)
            .digest("base64url");


    if (
        signature.length !==
        expectedSignature.length
    ) {
        return null;
    }


    const signaturesMatch =
        crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );


    if (!signaturesMatch) {
        return null;
    }


    try {

        return JSON.parse(
            Buffer
                .from(
                    data,
                    "base64url"
                )
                .toString("utf8")
        );

    } catch {

        return null;

    }
}


// ============================================================
// Exchange Authorization Code
// ============================================================

async function exchangeCode(code) {

    const response =
        await axios.post(
            "https://id.twitch.tv/oauth2/token",
            null,
            {
                params: {

                    client_id:
                        process.env.TWITCH_CLIENT_ID,

                    client_secret:
                        process.env.TWITCH_CLIENT_SECRET,

                    code,

                    grant_type:
                        "authorization_code",

                    redirect_uri:
                        process.env.TWITCH_REDIRECT_URI

                }
            }
        );


    return response.data;
}


// ============================================================
// Exports
// ============================================================

module.exports = {

    buildLoginURL,

    decodeState,

    exchangeCode

};