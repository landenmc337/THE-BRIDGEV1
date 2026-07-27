const CacheManager = {

    cache: new Map(),

    has(key) {
        return this.cache.has(key);
    },

    get(key) {
        return this.cache.get(key);
    },

    set(key, value) {
        this.cache.set(key, value);
    },

    remove(key) {
        this.cache.delete(key);
    },

    clear() {
        this.cache.clear();
    },

    size() {
        return this.cache.size;
    }

};