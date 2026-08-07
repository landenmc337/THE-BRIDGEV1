const fs = require("fs-extra");
const path = require("path");

const ACCOUNT_FILE = path.join(__dirname, "account.json");

async function save(account) {

    await fs.writeJson(
        ACCOUNT_FILE,
        account,
        { spaces: 4 }
    );

}

async function load() {

    if (!await fs.pathExists(ACCOUNT_FILE)) {
        return null;
    }

    return fs.readJson(ACCOUNT_FILE);

}

module.exports = {
    save,
    load
};