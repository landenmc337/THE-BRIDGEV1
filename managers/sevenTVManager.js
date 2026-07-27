const SevenTVManager = {

    emotes: {},

    async load(twitchUserId) {

        this.emotes = {};

        try {

            // -------------------------
            // Global Emotes
            // -------------------------

            const globalResponse = await fetch(
                "https://7tv.io/v3/emote-sets/global"
            );

            const globalData = await globalResponse.json();

            for (const emote of globalData.emotes) {

                this.emotes[emote.name] = {
                    id: emote.id,
                    url: `https://cdn.7tv.app/emote/${emote.id}/4x.webp`
                };

            }

            console.log(`🌍 Loaded ${globalData.emotes.length} global 7TV emotes`);

            // -------------------------
            // User Lookup (by Twitch ID)
            // -------------------------

            const userResponse = await fetch(
                `https://7tv.io/v3/users/twitch/${encodeURIComponent(twitchUserId)}`
            );

            if (!userResponse.ok) {

                console.log("ℹ️ No linked 7TV account.");
                return;

            }

            const user = await userResponse.json();

            const setId =
                user?.emote_set?.id ??
                user?.emote_sets?.[0]?.id;

            if (!setId) {

                console.log("ℹ️ No active emote set.");
                return;

            }

            // -------------------------
            // Channel Emotes
            // -------------------------

            const setResponse = await fetch(
                `https://api.7tv.app/v3/emote-sets/${encodeURIComponent(setId)}`
            );

            if (!setResponse.ok) {

                console.log("❌ Failed to load 7TV emote set.");
                return;

            }

            const set = await setResponse.json();

            for (const emote of set.emotes) {

                const id =
                    emote.id ??
                    emote.data?.id ??
                    emote.emote?.id;

                if (!id) continue;

                this.emotes[emote.name] = {
                    id,
                    url: `https://cdn.7tv.app/emote/${id}/4x.webp`
                };

            }

            console.log(`🎉 Loaded ${set.emotes.length} channel 7TV emotes`);
            console.log(`✅ Total 7TV emotes: ${Object.keys(this.emotes).length}`);

        }
        catch (err) {

            console.error("7TV Error:", err);

        }

    },

    process(text) {

        if (!text) return "";

        return text
            .split(" ")
            .map(word => {

                const emote = this.emotes[word];

                if (!emote) return word;

                return `<img class="emote"
                    src="${emote.url}"
                    alt="${word}"
                    loading="lazy"
                    decoding="async"
                    draggable="false">`;

            })
            .join(" ");

    }

};