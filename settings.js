const RelaySettings = (() => {

    const params = new URLSearchParams(window.location.search);

    return {

        channel: params.get("channel") || "deeno4k",

        fontSize: Number(params.get("font")) || 32,
        fadeTime: Number(params.get("fade")) || 45,

        badgeSize: Number(params.get("badgeSize")) || 40,
        emoteSize: Number(params.get("emoteSize")) || 72,

        align: params.get("align") || "left",

        layout: (params.get("layout") || "classic").toLowerCase(),

        theme: (params.get("theme") || "default").toLowerCase(),

        x: Number(params.get("x")) || 20,
        y: Number(params.get("y")) || 20,

        textColor: params.get("textColor") || "#FFFFFF",

        shadowColor: params.get("shadowColor") || "rgba(0,0,0,.9)",

        shadowBlur: Number(params.get("shadowBlur")) || 8,

        // Filters
        hideCommands: params.get("hideCommands") === "true",
        commandPrefix: params.get("commandPrefix") || "!"

    };

})();