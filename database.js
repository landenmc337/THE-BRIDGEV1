const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("railway.app")
        ? { rejectUnauthorized: false }
        : false
});

// Create the accounts table if it doesn't exist
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS accounts (
                id SERIAL PRIMARY KEY,
                display_name TEXT NOT NULL,
                login TEXT NOT NULL UNIQUE,
                user_id TEXT NOT NULL UNIQUE,
                access_token TEXT NOT NULL,
                refresh_token TEXT NOT NULL,
                connected_at BIGINT NOT NULL
            );
        `);

        console.log("✅ Accounts table ready.");
    } catch (err) {
        console.error("❌ Failed to create accounts table:");
        console.error(err);
    }
})();

module.exports = pool;