const axios = require("axios");
const crypto = require("crypto");
const Account = require("../data/account");
const PlatformConnections = require("../data/platformConnections");
const KickAuth = require("./kick");

const pendingStates = new Map();

async function createLogin(req, res) {
  try {
    const login = req.query.login
      ? String(req.query.login).toLowerCase()
      : null;

    let account = null;

    if (login) {
      account = await Account.loadByLogin(login);

      if (!account) {
        return res.status(404).send("Bridge account not found.");
      }
    }

    const result = KickAuth.buildLoginURL();

    pendingStates.set(result.state, {
      codeVerifier: result.codeVerifier,
      overlayId: account?.overlayId || null,
      login: account?.login || null,
      createdAt: Date.now(),
    });

    console.log(
      "🎯 Starting Kick OAuth for:",
      account?.login || "new Bridge account"
    );

    return res.redirect(result.url);
  } catch (err) {
    console.error("❌ Failed to create Kick login:", err);
    return res.status(500).send("Failed to start Kick login.");
  }
}

async function callback(req, res) {
  console.log("Kick callback query:", req.query);

  const { code, state, error } = req.query;

  if (error) {
    console.error("❌ Kick OAuth Error:", error);

    return res.send(`
      <h2>The Bridge4K</h2>
      <p>Kick login failed.</p>
    `);
  }

  if (!code) {
    return res.status(400).send("Missing authorization code.");
  }

  if (!state) {
    return res.status(400).send("Missing OAuth state.");
  }

  const pending = pendingStates.get(state);

  if (!pending) {
    return res.status(400).send("Invalid or expired OAuth state.");
  }

  pendingStates.delete(state);

  if (Date.now() - pending.createdAt > 10 * 60 * 1000) {
    return res
      .status(400)
      .send("OAuth session expired. Please try again.");
  }

  try {
    const tokens = await KickAuth.exchangeCode(
      code,
      pending.codeVerifier
    );

    console.log("✅ Kick OAuth successful.");

    const userResponse = await axios.get(
      "https://api.kick.com/public/v1/users",
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );

    const user = userResponse.data?.data?.[0];

    if (!user) {
      throw new Error("Kick user could not be found.");
    }

    const kickUserId = String(user.user_id);
    const displayName =
      user.name ||
      user.username ||
      "Kick User";

    const kickLogin =
      user.username ||
      displayName;

    console.log("👤 Kick User:", displayName);
    console.log("🆔 Kick User ID:", kickUserId);

    let account = null;

    // ------------------------------------------------------------
    // Connect Kick to existing Bridge account
    // ------------------------------------------------------------

    if (pending.login) {
      account = await Account.loadByLogin(
        pending.login
      );

      if (!account) {
        throw new Error(
          "Bridge account could not be found."
        );
      }

      console.log(
        "🔗 Existing Bridge account found."
      );
    }

    // ------------------------------------------------------------
    // Check whether this Kick account is already connected
    // ------------------------------------------------------------

    if (!account) {
      const existingConnection =
        await PlatformConnections.loadByPlatformUserId(
          "kick",
          kickUserId
        );

      if (existingConnection) {
        const accounts =
          await Account.loadAll();

        account =
          accounts.find(
            item =>
              item.overlayId ===
              existingConnection.overlayId
          ) || null;
      }
    }

    // ------------------------------------------------------------
    // Create Bridge account if Kick is first platform
    // ------------------------------------------------------------

    const overlayId =
      account?.overlayId ||
      "ovl_" +
        crypto.randomBytes(8).toString("hex");

    if (!account) {
      account = {
        overlayId,
        displayName,
        login: kickLogin,
        userId: kickUserId,
      };

      console.log(
        "💾 Creating new Bridge account."
      );
    }

    // ------------------------------------------------------------
    // Save Bridge account
    // ------------------------------------------------------------

    await Account.save({
      overlayId,

      displayName:
        account.displayName ||
        displayName,

      login:
        account.login ||
        kickLogin,

      userId:
        account.userId ||
        kickUserId,

      accessToken:
        account.accessToken ||
        null,

      refreshToken:
        account.refreshToken ||
        null,

      connectedAt:
        Date.now(),
    });

    console.log(
      "💾 Bridge account saved."
    );

    console.log(
      "🎯 Bridge Overlay ID:",
      overlayId
    );

    // ------------------------------------------------------------
    // Save Kick platform connection
    // ------------------------------------------------------------

    await PlatformConnections.save({
      overlayId,

      platform:
        "kick",

      platformUserId:
        kickUserId,

      displayName,

      login:
        kickLogin,

      accessToken:
        tokens.access_token,

      refreshToken:
        tokens.refresh_token,

      connectedAt:
        Date.now(),
    });

    console.log(
      "💾 Kick connection saved."
    );

    // ------------------------------------------------------------
    // Subscribe to Kick chat
    // ------------------------------------------------------------

    try {
      const subscriptionResponse =
        await axios.post(
          "https://api.kick.com/public/v1/events/subscriptions",
          {
            method: "webhook",

            events: [
              {
                name:
                  "chat.message.sent",

                version: 1,
              },
            ],
          },
          {
            headers: {
              Authorization:
                `Bearer ${tokens.access_token}`,

              "Content-Type":
                "application/json",
            },
          }
        );

      console.log(
        "📡 Kick chat subscription:",
        subscriptionResponse.data
      );
    } catch (subscriptionError) {
      console.error(
        "⚠️ Kick chat subscription failed:"
      );

      console.error(
        subscriptionError.response?.data ||
        subscriptionError.message
      );

      // Don't fail the OAuth connection
      // if the optional subscription fails.
    }

    // ------------------------------------------------------------
    // Return to production dashboard
    // ------------------------------------------------------------

    const landingUrl =
      process.env.LANDING_URL ||
      "https://www.thebridge4k.com";

    const dashboardLogin =
      account.login ||
      kickLogin;

    const dashboardUrl =
      `${landingUrl}/dashboard?login=${encodeURIComponent(
        dashboardLogin
      )}`;

    console.log(
      "➡️ Returning to dashboard:",
      dashboardUrl
    );

    return res.redirect(
      dashboardUrl
    );

  } catch (err) {
    console.error(
      "❌ Kick OAuth Callback Failed"
    );

    if (err.response) {
      console.error(
        "Kick API response:",
        err.response.data
      );
    } else {
      console.error(err);
    }

    return res
      .status(500)
      .send(
        "Kick OAuth failed."
      );
  }
}

module.exports = {
  createLogin,
  callback,
};