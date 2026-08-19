const BTTVFFZManager = {

    bttvEmotes: {},
    ffzEmotes: {},

    async load(twitchUserId) {

        this.bttvEmotes = {};
        this.ffzEmotes = {};

        await Promise.allSettled([
            this.loadBTTV(twitchUserId),
            this.loadFFZ(twitchUserId)
        ]);

        console.log(
            `✅ BTTV + FFZ ready: ${
                Object.keys(this.bttvEmotes).length
            } BTTV, ${
                Object.keys(this.ffzEmotes).length
            } FFZ`
        );
    },


    // ============================================================
    // BTTV
    // ============================================================

    async loadBTTV(twitchUserId) {

        try {

            // -------------------------
            // BTTV Global
            // -------------------------

            const globalResponse =
                await fetch(
                    "https://api.betterttv.net/3/cached/emotes/global"
                );

            if (globalResponse.ok) {

                const globalData =
                    await globalResponse.json();

                for (const emote of globalData) {

                    if (!emote?.code || !emote?.id) {
                        continue;
                    }

                    this.bttvEmotes[emote.code] = {
                        provider: "bttv",
                        id: emote.id,
                        url:
                            `https://cdn.betterttv.net/emote/${emote.id}/3x`
                    };
                }

                console.log(
                    `🌍 Loaded ${
                        globalData.length
                    } global BTTV emotes`
                );
            }


            // -------------------------
            // BTTV Channel
            // -------------------------

            if (!twitchUserId) {
                return;
            }

            const channelResponse =
                await fetch(
                    `https://api.betterttv.net/3/cached/users/twitch/${encodeURIComponent(
                        twitchUserId
                    )}`
                );

            if (!channelResponse.ok) {

                console.log(
                    "ℹ️ No BTTV channel emotes found."
                );

                return;
            }

            const channelData =
                await channelResponse.json();


            const channelEmotes =
                Array.isArray(
                    channelData.channelEmotes
                )
                    ? channelData.channelEmotes
                    : [];


            const sharedEmotes =
                Array.isArray(
                    channelData.sharedEmotes
                )
                    ? channelData.sharedEmotes
                    : [];


            for (
                const emote of [
                    ...channelEmotes,
                    ...sharedEmotes
                ]
            ) {

                if (!emote?.code || !emote?.id) {
                    continue;
                }

                this.bttvEmotes[emote.code] = {
                    provider: "bttv",
                    id: emote.id,
                    url:
                        `https://cdn.betterttv.net/emote/${emote.id}/3x`
                };
            }


            console.log(
                `🎉 Loaded ${
                    channelEmotes.length
                } channel + ${
                    sharedEmotes.length
                } shared BTTV emotes`
            );

        }
        catch (err) {

            console.error(
                "BTTV Error:",
                err
            );

        }

    },


    // ============================================================
    // FFZ
    // ============================================================

    async loadFFZ(twitchUserId) {

        try {

            // -------------------------
            // FFZ Global
            // -------------------------

            const globalResponse =
                await fetch(
                    "https://api.frankerfacez.com/v1/set/global"
                );

            if (globalResponse.ok) {

                const globalData =
                    await globalResponse.json();

                this.addFFZSets(
                    globalData?.sets
                );

                console.log(
                    `🌍 Loaded global FFZ emotes`
                );
            }


            // -------------------------
            // FFZ Channel
            // -------------------------

            if (!twitchUserId) {
                return;
            }

            const channelResponse =
                await fetch(
                    `https://api.frankerfacez.com/v1/room/id/${encodeURIComponent(
                        twitchUserId
                    )}`
                );

            if (!channelResponse.ok) {

                console.log(
                    "ℹ️ No FFZ channel emotes found."
                );

                return;
            }

            const channelData =
                await channelResponse.json();


            this.addFFZSets(
                channelData?.sets
            );


            console.log(
                "🎉 Loaded FFZ channel emotes"
            );

        }
        catch (err) {

            console.error(
                "FFZ Error:",
                err
            );

        }

    },


    // ============================================================
    // FFZ Set Parser
    // ============================================================

    addFFZSets(sets) {

        if (!sets || typeof sets !== "object") {
            return;
        }

        for (
            const set of Object.values(sets)
        ) {

            if (
                !set ||
                !Array.isArray(set.emoticons)
            ) {
                continue;
            }

            for (
                const emote of set.emoticons
            ) {

                if (
                    !emote?.name ||
                    !emote?.id
                ) {
                    continue;
                }


                const urls =
                    emote.urls || {};


                const url =
                    urls["4"] ||
                    urls["2"] ||
                    urls["1"] ||
                    `https://cdn.frankerfacez.com/emoticon/${emote.id}/4`;


                this.ffzEmotes[emote.name] = {
                    provider: "ffz",
                    id: emote.id,
                    url
                };

            }

        }

    },


    // ============================================================
    // Process BTTV + FFZ
    // ============================================================

    process(text) {

        if (!text) {
            return "";
        }


        return text
            .split(/(\s+)/)
            .map(token => {

                if (
                    !token ||
                    /^\s+$/.test(token) ||
                    token.startsWith("<img ")
                ) {
                    return token;
                }


                const bttv =
                    this.bttvEmotes[token];

                if (bttv) {

                    return `
                        <img
                            class="emote bttv-emote"
                            src="${bttv.url}"
                            alt="${token}"
                            title="${token}"
                            loading="lazy"
                            decoding="async"
                            draggable="false"
                        >
                    `;

                }


                const ffz =
                    this.ffzEmotes[token];

                if (ffz) {

                    return `
                        <img
                            class="emote ffz-emote"
                            src="${ffz.url}"
                            alt="${token}"
                            title="${token}"
                            loading="lazy"
                            decoding="async"
                            draggable="false"
                        >
                    `;

                }


                return token;

            })
            .join("");

    }

};