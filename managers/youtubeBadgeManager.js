const YouTubeBadgeManager = {

    badges: new Map(),

    async load(channelId) {

        if (!channelId) return;

        try {

            const response = await fetch(
                `assets/badges/youtube/${channelId}.json`
            );

            if (!response.ok) return;

            const data = await response.json();

            this.badges.set(channelId, data);

        } catch (e) {

            console.error(e);

        }

    },

    get(channelId, badge) {

        const channel = this.badges.get(channelId);

        if (!channel) return null;

        return channel[badge] || null;

    }

};