const RelaySettings = (() => {

    const params =
        new URLSearchParams(
            window.location.search
        );

    const pathParts =
        window.location.pathname
            .split("/")
            .filter(Boolean);

    const overlayLogin =
        pathParts[0]?.toLowerCase() === "overlay"
            ? pathParts[1]?.toLowerCase()
            : null;

    const channel =
        params.get("channel") ||
        overlayLogin ||
        null;


    // ============================================
    // Helper
    // ============================================

    const parseList = (value) => {

        return (
            value || ""
        )
            .split(",")
            .map(item =>
                item.trim().toLowerCase()
            )
            .filter(Boolean);
    };


    return {

        channel,


        // ===============================
        // Appearance
        // ===============================

        font:
            params.get("font")
            || "Segoe UI (Chatterino)",

        fontSize:
            Number(
                params.get("fontSize")
            )
            || 32,

        bubbleColor:
            params.get("bubbleColor")
            || "#27272A",

        showBubble:
            params.get("showBubble") !== "false",

        showPlatformIcons:
            params.get("showPlatformIcons") !== "false",

        fadeTime:
            Number(
                params.get("fade")
            )
            || 45,

        badgeSize:
            Number(
                params.get("fontSize")
            )
            || 32,

        emoteSize:
            Number(
                params.get("emoteSize")
            )
            || 72,

        align:
            params.get("align")
            || "left",

        layout:
            params.get("showBubble") === "true"
                ? "bubble"
                : "classic",

        theme:
            (
                params.get("theme")
                || "default"
            ).toLowerCase(),

        x:
            Number(
                params.get("x")
            )
            || 20,

        y:
            Number(
                params.get("y")
            )
            || 20,

        textColor:
            params.get("textColor")
            || "#FFFFFF",

        shadowColor:
            params.get("shadowColor")
            || "rgba(0,0,0,.9)",

        shadowBlur:
            Number(
                params.get("shadowBlur")
            )
            || 8,


        // ===============================
        // Chat Filters
        // ===============================

        hideBots:
            params.get("hideBots") === "true",

        hiddenBots:
            parseList(
                params.get("hiddenBots")
            ),

        hideCommands:
            params.get("hideCommands") === "true",

        commandPrefix:
            params.get("commandPrefix")
            || "!",

        hiddenUsers:
            parseList(
                params.get("hiddenUsers")
            )

    };

})();