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

        // 0 minute cache
        this.TTL = 1000 * 60 * 0;
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

        const result = await promise;

        this.pending.delete(twitchUserId);

        this.cache.set(twitchUserId, {
            expires: Date.now() + this.TTL,
            data: result
        });

        return result;
    }

    async fetchUser(twitchUserId) {
        try {
            // Get 7TV user
            const response = await axios.get(
                `https://7tv.io/v3/users/twitch/${twitchUserId}`
            );

            const payload = response.data;
            const user = payload.user ?? payload;
            console.log("v3 User ID:", user.id);
console.log("v3 Active Paint:", user.style?.active_paint_id ?? user.style?.activePaint);

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

const gqlUser = gql.data.data.users.user;

console.log("GraphQL Paint ID:", gqlUser.style.activePaint?.id);
console.log("GraphQL Paint Name:", gqlUser.style.activePaint?.name);

const style = gql.data?.data?.users?.user?.style;

console.log(JSON.stringify(style?.activePaint, null, 2));
            return {
                paintId: style?.activePaint?.id ?? null,
                badgeId: style?.activeBadge?.id ?? null,

                paint: style?.activePaint ?? null,
                badge: style?.activeBadge ?? null,

                effects: [],
                raw: style
            };

        } catch (err) {
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