const crypto = require("crypto");

const COOKIE_NAME = "bridge_session";

function getSecret() {
    const secret =
        process.env.SESSION_SECRET;

    if (!secret) {
        throw new Error(
            "SESSION_SECRET environment variable is required."
        );
    }

    return secret;
}

function createSessionToken({
    login,
    overlayId
}) {
    const payload = Buffer
        .from(
            JSON.stringify({
                login,
                overlayId,
                iat: Date.now()
            })
        )
        .toString("base64url");

    const signature =
        crypto
            .createHmac(
                "sha256",
                getSecret()
            )
            .update(payload)
            .digest("base64url");

    return `${payload}.${signature}`;
}

function verifySessionToken(token) {
    if (!token) {
        return null;
    }

    const parts =
        String(token).split(".");

    if (parts.length !== 2) {
        return null;
    }

    const [
        payload,
        signature
    ] = parts;

    const expectedSignature =
        crypto
            .createHmac(
                "sha256",
                getSecret()
            )
            .update(payload)
            .digest("base64url");

    const signatureBuffer =
        Buffer.from(signature);

    const expectedBuffer =
        Buffer.from(expectedSignature);

    if (
        signatureBuffer.length !==
        expectedBuffer.length
    ) {
        return null;
    }

    if (
        !crypto.timingSafeEqual(
            signatureBuffer,
            expectedBuffer
        )
    ) {
        return null;
    }

    try {
        const data =
            JSON.parse(
                Buffer
                    .from(
                        payload,
                        "base64url"
                    )
                    .toString("utf8")
            );

        if (
            !data.login ||
            !data.overlayId
        ) {
            return null;
        }

        return {
            login:
                String(data.login)
                    .trim()
                    .toLowerCase(),

            overlayId:
                String(data.overlayId)
                    .trim()
        };

    } catch {
        return null;
    }
}

function setSessionCookie(
    res,
    session
) {
    const token =
        createSessionToken(
            session
        );

    res.setHeader(
        "Set-Cookie",
        [
            `${COOKIE_NAME}=${token}`,
            "HttpOnly",
            "Secure",
            "SameSite=None",
            "Path=/",
            "Max-Age=604800"
        ].join("; ")
    );
}

function clearSessionCookie(res) {
    res.setHeader(
        "Set-Cookie",
        [
            `${COOKIE_NAME}=`,
            "HttpOnly",
            "Secure",
            "SameSite=None",
            "Path=/",
            "Max-Age=0"
        ].join("; ")
    );
}

function getSessionFromRequest(req) {
    const cookieHeader =
        req.headers.cookie || "";

    const cookies =
        cookieHeader
            .split(";")
            .map(
                item =>
                    item.trim()
            );

    const sessionCookie =
        cookies.find(
            cookie =>
                cookie.startsWith(
                    `${COOKIE_NAME}=`
                )
        );

    if (!sessionCookie) {
        return null;
    }

    const token =
        sessionCookie.slice(
            COOKIE_NAME.length + 1
        );

    return verifySessionToken(
        token
    );
}

module.exports = {
    COOKIE_NAME,
    createSessionToken,
    verifySessionToken,
    setSessionCookie,
    clearSessionCookie,
    getSessionFromRequest
};