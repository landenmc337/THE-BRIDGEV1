const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("railway.app")
        ? { rejectUnauthorized: false }
        : false
});


// ============================================================
// Database Initialization
// ============================================================

(async () => {

    try {

        // --------------------------------------------------------
        // Accounts Table
        // --------------------------------------------------------

        await pool.query(`
            CREATE TABLE IF NOT EXISTS accounts (
                id SERIAL PRIMARY KEY,
                overlay_id TEXT NOT NULL,
                display_name TEXT NOT NULL,
                login TEXT NOT NULL UNIQUE,
                user_id TEXT NOT NULL UNIQUE,
                access_token TEXT NOT NULL,
                refresh_token TEXT NOT NULL,
                connected_at BIGINT NOT NULL
            );
        `);

        console.log(
            "✅ Accounts table ready."
        );


        // --------------------------------------------------------
        // Ensure overlay_id Is Unique
        // --------------------------------------------------------

        await pool.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS
            accounts_overlay_id_unique
            ON accounts (overlay_id);
        `);

        console.log(
            "✅ Accounts overlay IDs are unique."
        );


        // --------------------------------------------------------
        // Platform Connections
        // --------------------------------------------------------

        await pool.query(`
            CREATE TABLE IF NOT EXISTS platform_connections (
                id SERIAL PRIMARY KEY,

                overlay_id TEXT NOT NULL,

                platform TEXT NOT NULL,

                platform_user_id TEXT NOT NULL,

                display_name TEXT,

                login TEXT,

                access_token TEXT,

                refresh_token TEXT,

                connected_at BIGINT NOT NULL,

                UNIQUE (overlay_id, platform),

                FOREIGN KEY (overlay_id)
                    REFERENCES accounts(overlay_id)
                    ON DELETE CASCADE
            );
        `);

        console.log(
            "✅ Platform connections table ready."
        );


    } catch (err) {

        console.error(
            "❌ Failed to initialize database:"
        );

        console.error(err);

    }

})();


module.exports = pool;