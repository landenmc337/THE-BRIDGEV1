const db = require("../database");

async function save(account) {

    await db.query(
        `
        INSERT INTO accounts (
            display_name,
            login,
            user_id,
            access_token,
            refresh_token,
            connected_at
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (login)
        DO UPDATE SET
            display_name = EXCLUDED.display_name,
            user_id = EXCLUDED.user_id,
            access_token = EXCLUDED.access_token,
            refresh_token = EXCLUDED.refresh_token,
            connected_at = EXCLUDED.connected_at
        `,
        [
            account.displayName,
            account.login,
            account.userId,
            account.accessToken,
            account.refreshToken,
            account.connectedAt
        ]
    );

}

async function load() {

    const result = await db.query(`
        SELECT *
        FROM accounts
        LIMIT 1
    `);

    if (result.rows.length === 0) {
        return null;
    }

    const account = result.rows[0];

    return {
        displayName: account.display_name,
        login: account.login,
        userId: account.user_id,
        accessToken: account.access_token,
        refreshToken: account.refresh_token,
        connectedAt: account.connected_at
    };

}

module.exports = {
    save,
    load
};