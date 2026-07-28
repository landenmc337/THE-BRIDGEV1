const Layouts = {

    classic(data) {

        return `
            <div class="message-row">
                ${createPlatform(data)}
                ${createBadges(data)}

                <div class="message-content">
                    ${createUsername(data)}
                    ${createText(data)}
                </div>
            </div>
        `;

    },

    bubble(data) {

        return `
            <div class="bubble">

                <div class="message-row">
                    ${createPlatform(data)}
                    ${createBadges(data)}

                    <div class="message-content">
                        ${createUsername(data)}
                        ${createText(data)}
                    </div>
                </div>

            </div>
        `;

    },

    pill(data) {

        return `
            <div class="message-row">
                ${createPlatform(data)}
                ${createBadges(data)}

                <div class="message-content">
                    <span
                        class="username-pill"
                        style="background:${data.color || "#9146FF"}"
                    >
                        ${data.username}
                    </span>

                    ${createText(data)}
                </div>
            </div>
        `;

    },

    compact(data) {

        return `
            <div class="message-row compact">
                ${createBadges(data)}

                <div class="message-content">
                    ${createUsername(data)}
                    ${createText(data)}
                </div>
            </div>
        `;

    },

    twitch(data) {

        return Layouts.classic(data);

    },

    chatis(data) {

        return Layouts.bubble(data);

    },

    glass(data) {

        return `
            <div class="glass">

                <div class="message-row">
                    ${createPlatform(data)}
                    ${createBadges(data)}

                    <div class="message-content">
                        ${createUsername(data)}
                        ${createText(data)}
                    </div>
                </div>

            </div>
        `;

    },

    gaming(data) {

        return Layouts.glass(data);

    },

    esports(data) {

        return Layouts.bubble(data);

    }

};