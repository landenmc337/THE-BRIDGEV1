const WebSocket = require("ws");
const PlatformConnections = require("../data/platformConnections");

const clients = new Map();

async function connectAccount(account) {
    const connection = await PlatformConnections.load(
        account.overlayId,
        "kick"
    );

    if (!connection) {
        console.log(`⚠️ No Kick connection for ${account.login}`);
        return;
    }

    console.log(`🔌 Connecting Kick chat for ${account.login}...`);

    // We'll add the actual Kick Events API connection next.
}

async function initialize() {
    console.log("🔄 Kick initialization starting...");

    const Account = require("../data/account");
    const accounts = await Account.loadAll();

    for (const account of accounts) {
        await connectAccount(account);
    }
}

module.exports = {
    initialize,
    connectAccount,
};