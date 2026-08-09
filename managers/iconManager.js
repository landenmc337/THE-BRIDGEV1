const IconManager = {

    get(platform) {

        switch ((platform || "").toLowerCase()) {

            case "twitch":
                return "/assets/icons/twitch.svg";

            case "youtube":
                return "/assets/icons/youtube.svg";

            case "kick":
                return "/assets/icons/kick.svg";

            default:
                return "";

        }

    }

};