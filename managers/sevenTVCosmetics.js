const axios = require("axios");

const ONE_USER_QUERY = `
query OneUser($id: Id!) {
  users {
    user(id: $id) {
      style {
        activePaint {
          id
          name
          data {
            layers {
              id
              ty {
                __typename

                ... on PaintLayerTypeSingleColor {
                  color {
                    hex
                  }
                }

                ... on PaintLayerTypeLinearGradient {
                  angle
                  repeating
                  stops {
                    at
                    color {
                      hex
                    }
                  }
                }

                ... on PaintLayerTypeRadialGradient {
                  repeating
                  shape
                  stops {
                    at
                    color {
                      hex
                    }
                  }
                }

                ... on PaintLayerTypeImage {
                  images {
                    url
                    mime
                    size
                    scale
                    width
                    height
                    frameCount
                  }
                }
              }
              opacity
            }

            shadows {
              color {
                hex
              }
              offsetX
              offsetY
              blur
            }
          }
        }

        activeBadge {
          id
          name
          description

          images {
            url
            mime
            size
            scale
            width
            height
            frameCount
          }
        }
      }
    }
  }
}
`;

class SevenTVCosmetics {
    constructor() {
        this.cache = new Map();
        this.pending = new Map();

        // Cache successful and unsuccessful lookups for 10 minutes.
        // This prevents repeated 7TV API requests for users
        // who do not have a 7TV account.
        this.TTL = 1000 * 30;
    }

    async get(twitchUserId) {
        if (!twitchUserId) {
            return this.empty();
        }

        const cached = this.cache.get(twitchUserId);

        if (cached && cached.expires > Date.now()) {
            return cached.data;
        }

        if (this.pending.has(twitchUserId)) {
            return this.pending.get(twitchUserId);
        }

        const promise = this.fetchUser(twitchUserId);

        this.pending.set(twitchUserId, promise);

        try {
            const result = await promise;

            this.cache.set(twitchUserId, {
                expires: Date.now() + this.TTL,
                data: result
            });

            return result;

        } finally {
            this.pending.delete(twitchUserId);
        }
    }

    async fetchUser(twitchUserId) {
        try {
            // Get 7TV user
            const response = await axios.get(
                `https://7tv.io/v3/users/twitch/${twitchUserId}`
            );

            const payload = response.data;
            const user = payload.user ?? payload;

            if (!user?.id) {
                return this.empty();
            }

            // Get cosmetics from GraphQL
            const gql = await axios.post(
                "https://api.7tv.app/v4/gql",
                {
                    operationName: "OneUser",
                    query: ONE_USER_QUERY,
                    variables: {
                        id: user.id
                    }
                }
            );

            const style =
                gql.data?.data?.users?.user?.style;

            return {
                paintId:
                    style?.activePaint?.id ?? null,

                badgeId:
                    style?.activeBadge?.id ?? null,

                paint:
                    style?.activePaint ?? null,

                badge:
                    style?.activeBadge ?? null,

                effects: [],

                raw: style
            };

        } catch (err) {

            const status =
                err.response?.status;

            const errorCode =
                err.response?.data?.error_code;

            // A Twitch user not having a 7TV account is normal.
            // Return empty cosmetics without spamming the console.
            if (
                status === 404 ||
                errorCode === 12000
            ) {
                return this.empty();
            }

            console.error(
                "7TV Cosmetics Error:",
                err.response?.data || err.message
            );

            return this.empty();
        }
    }

    empty() {
        return {
            paintId: null,
            badgeId: null,
            paint: null,
            badge: null,
            effects: [],
            raw: null
        };
    }
}

module.exports = new SevenTVCosmetics();