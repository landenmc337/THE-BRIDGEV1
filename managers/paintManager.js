const cache = new Map();

export async function getPaint(paintId) {

    if (!paintId) return null;

    if (cache.has(paintId)) {
        return cache.get(paintId);
    }

    const res = await fetch(`https://7tv.io/v3/cosmetics/paints/${paintId}`);

    if (!res.ok) return null;

    const paint = await res.json();

    cache.set(paintId, paint);

    return paint;

}