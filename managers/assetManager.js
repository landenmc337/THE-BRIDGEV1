const AssetManager = {

    getBadge(platform, badge, version, channelId = null) {

        platform = PlatformManager.normalize(platform);

        // --------------------------
        // YouTube Badges
        // --------------------------
        if (platform === "youtube") {

            const ytBadge = YouTubeBadgeManager.get(channelId, badge);

            if (ytBadge) {
                return ytBadge;
            }

            return "";

        }

        // --------------------------
        // Twitch Subscriber Badges
        // --------------------------
        if (platform === "twitch" && badge === "subscriber") {

            let value = parseInt(version, 10);

            if (isNaN(value)) {
                return "";
            }

            // Determine badge tier.
            // Examples:
            // 3      -> tier 0
            // 2006   -> tier 2000
            // 3066   -> tier 3000
            const tier = Math.floor(value / 1000) * 1000;

            let month = tier > 0
                ? value - tier
                : value;

            // Base badge should always be used for month 1.
            if (month === 1) {
                month = 0;
            }

            while (month >= 0) {

                const lookupVersion =
                    tier > 0
                        ? String(tier + month)
                        : String(month);

                const badgePath = BadgeManager.exists(
                    platform,
                    badge,
                    lookupVersion
                );

                if (badgePath) {
                    return badgePath;
                }

                month--;

            }

            return "";

        }

        // --------------------------
        // Everything Else
        // --------------------------
        return BadgeManager.get(
            platform,
            badge,
            version
        );

    },

    getPlatformIcon(platform) {

        return IconManager.get(
            PlatformManager.normalize(platform)
        );

    }

};