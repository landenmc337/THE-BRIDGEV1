require("dotenv").config();

const crypto = require("crypto");


// ============================================================
// PKCE
// ============================================================

function createCodeVerifier() {

    return crypto
        .randomBytes(32)
        .toString("base64url");
}


function createCodeChallenge(
    codeVerifier
) {

    return crypto
        .createHash("sha256")
        .update(codeVerifier)
        .digest("base64url");
}


// ============================================================
// OAuth State
// ============================================================

function createState() {

    return crypto
        .randomBytes(32)
        .toString("hex");
}


// ============================================================
// Build Kick Login URL
// ============================================================

function buildLoginURL() {

    const state =
        createState();

    const codeVerifier =
        createCodeVerifier();

    const codeChallenge =
        createCodeChallenge(
            codeVerifier
        );

    const params =
        new URLSearchParams({
            client_id:
                process.env.KICK_CLIENT_ID,

            redirect_uri:
                process.env.KICK_REDIRECT_URI,

            response_type:
                "code",

            scope:
                "user:read events:subscribe",

            state,

            code_challenge:
                codeChallenge,

            code_challenge_method:
                "S256"
        });

    return {
        state,

        codeVerifier,

        url:
            "https://id.kick.com/oauth/authorize?" +
            params.toString()
    };
}


// ============================================================
// Exchange Authorization Code
// ============================================================

async function exchangeCode(
    code,
    codeVerifier
) {

    const response =
        await fetch(
            "https://id.kick.com/oauth/token",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded"
                },

                body:
                    new URLSearchParams({
                        grant_type:
                            "authorization_code",

                        client_id:
                            process.env.KICK_CLIENT_ID,

                        client_secret:
                            process.env.KICK_CLIENT_SECRET,

                        code,

                        redirect_uri:
                            process.env.KICK_REDIRECT_URI,

                        code_verifier:
                            codeVerifier
                    })
            }
        );

    if (!response.ok) {

        const errorText =
            await response.text();

        throw new Error(
            `Kick token exchange failed: ${response.status} ${errorText}`
        );
    }

    return response.json();
}


module.exports = {
    buildLoginURL,
    exchangeCode
};