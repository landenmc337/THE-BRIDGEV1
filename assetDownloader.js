require("dotenv").config();

const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const { getAppToken, getUserId } = require("./twitchAuth");

async function downloadImage(url, destination, overwrite = false) {

    if (!overwrite && await fs.pathExists(destination)) {
        return;
    }

    await fs.ensureDir(path.dirname(destination));

    const response = await axios({
        url,
        method: "GET",
        responseType: "stream"
    });

    const writer = fs.createWriteStream(destination);

    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
    });

}

async function downloadBadgeSet(data, rootFolder, overwrite = false) {

    for (const badgeSet of data) {

        const badgeFolder = path.join(
            rootFolder,
            badgeSet.set_id
        );

        await fs.ensureDir(badgeFolder);

        for (const version of badgeSet.versions) {

            const file = path.join(
                badgeFolder,
                `${version.id}.png`
            );

            await downloadImage(
                version.image_url_4x,
                file,
                overwrite
            );

            console.log(`✅ ${badgeSet.set_id}/${version.id}.png`);

        }

    }

}

async function downloadGlobalBadges(token) {

    console.log("🌍 Downloading global badges...");

    const response = await axios.get(
        "https://api.twitch.tv/helix/chat/badges/global",
        {
            headers: {
                "Client-ID": process.env.TWITCH_CLIENT_ID,
                "Authorization": `Bearer ${token}`
            }
        }
    );

    const folder = path.join(
    __dirname,
    "assets",
    "badges",
    "twitch"
);
    console.log("📁 Saving global badges to:", folder);

    await downloadBadgeSet(
        response.data.data,
        folder,
        false
    );

}

async function downloadChannelBadges(token, username) {

    console.log(`📺 Downloading channel badges for ${username}...`);

    const broadcasterId = await getUserId(username);

    const response = await axios.get(
        "https://api.twitch.tv/helix/chat/badges",
        {
            headers: {
                "Client-ID": process.env.TWITCH_CLIENT_ID,
                "Authorization": `Bearer ${token}`
            },
            params: {
                broadcaster_id: broadcasterId
            }
        }
    );

    const folder = path.join(
    __dirname,
    "assets",
    "badges",
    "twitch"
);
    console.log("📁 Saving channel badges to:", folder);

    await downloadBadgeSet(
        response.data.data,
        folder,
        true
    );

}

async function downloadBadges(username = "deeno4k") {

    try {

        console.log("🔍 Checking Twitch badge assets...");

        const token = await getAppToken();

        await downloadGlobalBadges(token);

        await downloadChannelBadges(
            token,
            username
        );

        console.log("🎉 All Twitch badges are up to date.");

    } catch (err) {

        console.error("❌ Badge download failed:");

        if (err.response) {
            console.error(err.response.data);
        } else {
            console.error(err.message);
        }

    }

}

module.exports = {
    downloadBadges,
    downloadChannelBadges
};

if (require.main === module) {
    downloadBadges().catch(console.error);
}