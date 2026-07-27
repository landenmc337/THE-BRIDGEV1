const BadgeManager = {

    get(platform, badge, version = "1") {

        switch (platform) {

            case "twitch":
                return `assets/badges/twitch/${badge}/${version}.png`;

            case "youtube":
                return `assets/badges/youtube/${badge}/${version}.png`;

            default:
                return null;

        }

    },

    exists(platform, badge, version = "1") {

        const path = this.get(platform, badge, version);

        if (!path) {
            return false;
        }

        return path;

    }

};