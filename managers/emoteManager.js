const EmoteManager = {

    process(text, emotes = {}) {

        if (!text) return "";

        let html = text;

        if (!Object.keys(emotes).length) {
            return html;
        }

        const replacements = [];

        for (const [id, positions] of Object.entries(emotes)) {
            for (const position of positions) {

                const [start, end] = position.split("-").map(Number);

                replacements.push({
                    start,
                    end,
                    id
                });

            }
        }

        replacements.sort((a, b) => b.start - a.start);

        for (const emote of replacements) {

            const url = `https://static-cdn.jtvnw.net/emoticons/v2/${emote.id}/default/dark/3.0`;

            const img = `<img class="emote" src="${url}" alt="" loading="lazy" decoding="async" draggable="false">`;

            html =
                html.slice(0, emote.start) +
                img +
                html.slice(emote.end + 1);
        }

        return html.trim();

    }

};