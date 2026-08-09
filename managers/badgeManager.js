const BadgeManager = {

    get(
        platform,
        badge,
        version = "1",
        overlayId = null
    ) {

        switch (platform) {

            case "twitch":

                // Channel-specific badges
                if (
                    overlayId &&
                    badge === "subscriber"
                ) {

                    return `/assets/badges/twitch/${overlayId}/${badge}/${version}.png`;

                }

                // Global Twitch badges
                return `/assets/badges/twitch/${badge}/${version}.png`;

            case "youtube":

                return `/assets/badges/youtube/${badge}/${version}.png`;

            default:

                return null;

        }

    },

    exists(
        platform,
        badge,
        version = "1",
        overlayId = null
    ) {

        const badgePath =
            this.get(
                platform,
                badge,
                version,
                overlayId
            );

        if (!badgePath) {
            return null;
        }

        const img = new Image();

        img.src = badgePath;

        return badgePath;

    }

};