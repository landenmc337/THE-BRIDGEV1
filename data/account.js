const db = require("../database");

async function save(account) {

    await db.query(
        `
        INSERT INTO accounts (
            overlay_id,
            display_name,
            login,
            user_id,
            access_token,
            refresh_token,
            connected_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (login)
        DO UPDATE SET
            overlay_id = EXCLUDED.overlay_id,
            display_name = EXCLUDED.display_name,
            user_id = EXCLUDED.user_id,
            access_token = EXCLUDED.access_token,
            refresh_token = EXCLUDED.refresh_token,
            connected_at = EXCLUDED.connected_at
        `,
        [
            account.overlayId,
            account.displayName,
            account.login,
            account.userId,
            account.accessToken,
            account.refreshToken,
            account.connectedAt
        ]
    );

}

async function loadByLogin(login) {

    const result = await db.query(
        `
        SELECT *
        FROM accounts
        WHERE login = $1
        LIMIT 1
        `,
        [login]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const account = result.rows[0];

    return {
        overlayId: account.overlay_id,
        displayName: account.display_name,
        login: account.login,
        userId: account.user_id,
        accessToken: account.access_token,
        refreshToken: account.refresh_token,
        connectedAt: account.connected_at
    };

}

async function loadByOverlayId(overlayId) {

    const result = await db.query(
        `
        SELECT *
        FROM accounts
        WHERE overlay_id = $1
        LIMIT 1
        `,
        [overlayId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const account = result.rows[0];

    return {
        overlayId: account.overlay_id,
        displayName: account.display_name,
        login: account.login,
        userId: account.user_id,
        accessToken: account.access_token,
        refreshToken: account.refresh_token,
        connectedAt: account.connected_at
    };

}

async function loadAll() {

    const result = await db.query(`
        SELECT *
        FROM accounts
        ORDER BY connected_at DESC
    `);

    return result.rows.map(account => ({
        overlayId: account.overlay_id,
        displayName: account.display_name,
        login: account.login,
        userId: account.user_id,
        accessToken: account.access_token,
        refreshToken: account.refresh_token,
        connectedAt: account.connected_at
    }));

}

module.exports = {
    save,
    loadByLogin,
    loadByOverlayId,
    loadAll
};