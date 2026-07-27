const PlatformManager = {

    normalize(platform) {

        if (!platform) return "twitch";

        platform = platform.toLowerCase();

        switch (platform) {

            case "twitch":
                return "twitch";

            case "youtube":
            case "yt":
                return "youtube";

            case "kick":
                return "kick";

            default:
                return "twitch";

        }

    }

};