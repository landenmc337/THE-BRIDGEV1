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
// Signed OAuth State
// ============================================================

function createState(
    login = null
) {

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
                process.env.KICK_CLIENT_SECRET
            )
            .update(data)
            .digest("base64url");


    return `${data}.${signature}`;

}


// ============================================================
// Decode + Verify OAuth State
// ============================================================

function decodeState(
    state
) {

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
                process.env.KICK_CLIENT_SECRET
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
                "⚠️ Kick OAuth state expired."
            );

            return null;

        }


        return stateData;


    } catch {

        return null;

    }

}


// ============================================================
// Build Kick Login URL
// ============================================================

function buildLoginURL(
    login = null
) {

    const state =
        createState(
            login
        );


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


// ============================================================
// Exports
// ============================================================

module.exports = {

    buildLoginURL,

    decodeState,

    exchangeCode

};