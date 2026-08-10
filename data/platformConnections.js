const db = require("../database");

// ============================================================
// Save Platform Connection
// ============================================================

async function save(connection) {

    await db.query(
        `
        INSERT INTO platform_connections (
            overlay_id,
            platform,
            platform_user_id,
            display_name,
            login,
            access_token,
            refresh_token,
            connected_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)

        ON CONFLICT (overlay_id, platform)

        DO UPDATE SET
            platform_user_id = EXCLUDED.platform_user_id,
            display_name = EXCLUDED.display_name,
            login = EXCLUDED.login,
            access_token = EXCLUDED.access_token,
            refresh_token = EXCLUDED.refresh_token,
            connected_at = EXCLUDED.connected_at
        `,
        [
            connection.overlayId,
            connection.platform,
            connection.platformUserId,
            connection.displayName || null,
            connection.login || null,
            connection.accessToken || null,
            connection.refreshToken || null,
            connection.connectedAt
        ]
    );
}

// ============================================================
// Load One Platform Connection
// ============================================================

async function load(
    overlayId,
    platform
) {

    const result =
        await db.query(
            `
            SELECT *
            FROM platform_connections
            WHERE overlay_id = $1
              AND platform = $2
            LIMIT 1
            `,
            [
                overlayId,
                platform
            ]
        );

    if (
        result.rows.length === 0
    ) {

        return null;

    }

    const connection =
        result.rows[0];

    return {

        id:
            connection.id,

        overlayId:
            connection.overlay_id,

        platform:
            connection.platform,

        platformUserId:
            connection.platform_user_id,

        displayName:
            connection.display_name,

        login:
            connection.login,

        accessToken:
            connection.access_token,

        refreshToken:
            connection.refresh_token,

        connectedAt:
            connection.connected_at

    };
}

// ============================================================
// Load By Platform User ID
// ============================================================

async function loadByPlatformUserId(
    platform,
    platformUserId
) {

    const result =
        await db.query(
            `
            SELECT *
            FROM platform_connections
            WHERE platform = $1
              AND platform_user_id = $2
            LIMIT 1
            `,
            [
                platform,
                String(platformUserId)
            ]
        );

    if (
        result.rows.length === 0
    ) {

        return null;

    }

    const connection =
        result.rows[0];

    return {

        id:
            connection.id,

        overlayId:
            connection.overlay_id,

        platform:
            connection.platform,

        platformUserId:
            connection.platform_user_id,

        displayName:
            connection.display_name,

        login:
            connection.login,

        accessToken:
            connection.access_token,

        refreshToken:
            connection.refresh_token,

        connectedAt:
            connection.connected_at

    };
}

// ============================================================
// Load By Platform Login
// ============================================================

async function loadByPlatformLogin(
    platform,
    login
) {

    const result =
        await db.query(
            `
            SELECT *
            FROM platform_connections
            WHERE platform = $1
              AND LOWER(login) = LOWER($2)
            LIMIT 1
            `,
            [
                platform,
                login
            ]
        );

    if (
        result.rows.length === 0
    ) {

        return null;

    }

    const connection =
        result.rows[0];

    return {

        id:
            connection.id,

        overlayId:
            connection.overlay_id,

        platform:
            connection.platform,

        platformUserId:
            connection.platform_user_id,

        displayName:
            connection.display_name,

        login:
            connection.login,

        accessToken:
            connection.access_token,

        refreshToken:
            connection.refresh_token,

        connectedAt:
            connection.connected_at

    };
}

// ============================================================
// Load All Connections For Overlay
// ============================================================

async function loadByOverlayId(
    overlayId
) {

    const result =
        await db.query(
            `
            SELECT *
            FROM platform_connections
            WHERE overlay_id = $1
            ORDER BY connected_at DESC
            `,
            [overlayId]
        );

    return result.rows.map(
        connection => ({

            id:
                connection.id,

            overlayId:
                connection.overlay_id,

            platform:
                connection.platform,

            platformUserId:
                connection.platform_user_id,

            displayName:
                connection.display_name,

            login:
                connection.login,

            accessToken:
                connection.access_token,

            refreshToken:
                connection.refresh_token,

            connectedAt:
                connection.connected_at

        })
    );
}

// ============================================================
// Delete Platform Connection
// ============================================================

async function remove(
    overlayId,
    platform
) {

    await db.query(
        `
        DELETE FROM platform_connections
        WHERE overlay_id = $1
          AND platform = $2
        `,
        [
            overlayId,
            platform
        ]
    );
}

module.exports = {
    save,
    load,
    loadByPlatformUserId,
    loadByPlatformLogin,
    loadByOverlayId,
    remove
};