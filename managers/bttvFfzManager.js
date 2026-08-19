const BTTVFFZManager = {

    bttvEmotes: {},
    ffzEmotes: {},

    async load(
        twitchUserId,
        twitchUsername
    ) {

        this.bttvEmotes = {};
        this.ffzEmotes = {};

        await Promise.allSettled([
            this.loadBTTV(
                twitchUserId,
                twitchUsername
            ),

            this.loadFFZ(
                twitchUserId,
                twitchUsername
            )
        ]);

        console.log(
            `✅ BTTV + FFZ ready: ${
                Object.keys(
                    this.bttvEmotes
                ).length
            } BTTV, ${
                Object.keys(
                    this.ffzEmotes
                ).length
            } FFZ`
        );

        console.log(
            "🔎 OMEGALUL:",
            !!(
                this.bttvEmotes.OMEGALUL ||
                this.ffzEmotes.OMEGALUL
            )
        );

        console.log(
            "🔎 PepeLaugh:",
            !!(
                this.bttvEmotes.Pepelaugh ||
                this.bttvEmotes.PepeLaugh ||
                this.ffzEmotes.Pepelaugh ||
                this.ffzEmotes.PepeLaugh
            )
        );
    },


    // ============================================================
    // BTTV
    // ============================================================

    async loadBTTV(
        twitchUserId,
        twitchUsername
    ) {

        try {

            // ----------------------------------------------------
            // BTTV Global
            // ----------------------------------------------------

            const globalResponse =
                await fetch(
                    "https://api.betterttv.net/3/cached/emotes/global"
                );

            if (globalResponse.ok) {

                const globalData =
                    await globalResponse.json();

                this.addBTTVEmotes(
                    globalData
                );

                console.log(
                    `🌍 Loaded ${
                        globalData.length
                    } global BTTV emotes`
                );
            }


            // ----------------------------------------------------
            // BTTV Channel
            // ----------------------------------------------------

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
                    "ℹ️ No BTTV channel emotes found for this channel."
                );

                return;
            }


            const channelData =
                await channelResponse.json();


            const channelEmotes =
                Array.isArray(
                    channelData?.channelEmotes
                )
                    ? channelData.channelEmotes
                    : [];


            const sharedEmotes =
                Array.isArray(
                    channelData?.sharedEmotes
                )
                    ? channelData.sharedEmotes
                    : [];


            this.addBTTVEmotes(
                [
                    ...channelEmotes,
                    ...sharedEmotes
                ]
            );


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
                "❌ BTTV Error:",
                err
            );

        }

    },


    // ============================================================
    // BTTV Parser
    // ============================================================

    addBTTVEmotes(emotes) {

        if (!Array.isArray(emotes)) {
            return;
        }


        for (
            const emote of emotes
        ) {

            if (
                !emote?.code ||
                !emote?.id
            ) {
                continue;
            }


            this.bttvEmotes[
                emote.code
            ] = {

                provider:
                    "bttv",

                id:
                    emote.id,

                url:
                    `https://cdn.betterttv.net/emote/${emote.id}/3x`

            };

        }

    },


    // ============================================================
    // FFZ
    // ============================================================

    async loadFFZ(
        twitchUserId,
        twitchUsername
    ) {

        try {

            // ----------------------------------------------------
            // FFZ Global
            // ----------------------------------------------------

            const globalResponse =
                await fetch(
                    "https://api.frankerfacez.com/v1/set/global"
                );


            if (globalResponse.ok) {

                const globalData =
                    await globalResponse.json();


                const defaultSets =
                    Array.isArray(
                        globalData?.default_sets
                    )
                        ? globalData.default_sets
                        : [];


                for (
                    const setId of defaultSets
                ) {

                    const set =
                        globalData?.sets?.[
                            String(setId)
                        ];


                    if (!set) {
                        continue;
                    }


                    this.addFFZEmotes(
                        set.emoticons
                    );

                }


                console.log(
                    `🌍 Loaded FFZ global sets: ${
                        defaultSets.length
                    }`
                );

            }


            // ----------------------------------------------------
            // FFZ Channel
            // ----------------------------------------------------

            let channelResponse =
                null;


            // Try Twitch username first.
            // FFZ identifies rooms by channel name.

            if (twitchUsername) {

                const username =
                    String(
                        twitchUsername
                    )
                        .trim()
                        .toLowerCase();


                channelResponse =
                    await fetch(
                        `https://api.frankerfacez.com/v1/room/${encodeURIComponent(
                            username
                        )}`
                    );


                if (
                    channelResponse.ok
                ) {

                    console.log(
                        `🎯 FFZ channel found by username: ${username}`
                    );

                }

            }


            // Fall back to Twitch ID if
            // username lookup didn't work.

            if (
                !channelResponse ||
                !channelResponse.ok
            ) {

                if (twitchUserId) {

                    channelResponse =
                        await fetch(
                            `https://api.frankerfacez.com/v1/room/id/${encodeURIComponent(
                                twitchUserId
                            )}`
                        );

                }

            }


            if (
                !channelResponse ||
                !channelResponse.ok
            ) {

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
                "❌ FFZ Error:",
                err
            );

        }

    },


    // ============================================================
    // FFZ Sets
    // ============================================================

    addFFZSets(sets) {

        if (
            !sets ||
            typeof sets !== "object"
        ) {
            return;
        }


        for (
            const set of Object.values(
                sets
            )
        ) {

            if (
                !set ||
                !Array.isArray(
                    set.emoticons
                )
            ) {
                continue;
            }


            this.addFFZEmotes(
                set.emoticons
            );

        }

    },


    // ============================================================
    // FFZ Emotes
    // ============================================================

    addFFZEmotes(emotes) {

        if (!Array.isArray(emotes)) {
            return;
        }


        for (
            const emote of emotes
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


            this.ffzEmotes[
                emote.name
            ] = {

                provider:
                    "ffz",

                id:
                    emote.id,

                url

            };

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


                // ------------------------------------------------
                // Exact BTTV match
                // ------------------------------------------------

                const bttv =
                    this.bttvEmotes[
                        token
                    ];


                if (bttv) {

                    return this.render(
                        bttv,
                        token
                    );

                }


                // ------------------------------------------------
                // Exact FFZ match
                // ------------------------------------------------

                const ffz =
                    this.ffzEmotes[
                        token
                    ];


                if (ffz) {

                    return this.render(
                        ffz,
                        token
                    );

                }


                // ------------------------------------------------
                // Case-insensitive BTTV match
                // ------------------------------------------------

                const lower =
                    token.toLowerCase();


                const bttvKey =
                    Object.keys(
                        this.bttvEmotes
                    ).find(
                        key =>
                            key.toLowerCase() ===
                            lower
                    );


                if (bttvKey) {

                    return this.render(
                        this.bttvEmotes[
                            bttvKey
                        ],
                        token
                    );

                }


                // ------------------------------------------------
                // Case-insensitive FFZ match
                // ------------------------------------------------

                const ffzKey =
                    Object.keys(
                        this.ffzEmotes
                    ).find(
                        key =>
                            key.toLowerCase() ===
                            lower
                    );


                if (ffzKey) {

                    return this.render(
                        this.ffzEmotes[
                            ffzKey
                        ],
                        token
                    );

                }


                return token;

            })
            .join("");

    },


    // ============================================================
    // Render
    // ============================================================

    render(
        emote,
        token
    ) {

        return `
            <img
                class="emote ${
                    emote.provider
                }-emote"
                src="${emote.url}"
                alt="${token}"
                title="${token}"
                loading="lazy"
                decoding="async"
                draggable="false"
            >
        `;

    }

};