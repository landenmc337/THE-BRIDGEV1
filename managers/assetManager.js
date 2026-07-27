const AssetManager = {

    getBadge(platform, badge, version, channelId = null) {

        platform = PlatformManager.normalize(platform);

        if (platform === "youtube") {

            const ytBadge = YouTubeBadgeManager.get(channelId, badge);

            if (ytBadge) {
                return ytBadge;
            }

            return "";

        }

        return BadgeManager.get(platform, badge, version);

    },

    getPlatformIcon(platform) {

        return IconManager.get(
            PlatformManager.normalize(platform)
        );

    }

};