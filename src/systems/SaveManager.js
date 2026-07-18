// Persistence via localStorage (the Candy Box / A-Dark-Room approach — NOT cookies:
// bigger, client-only, a simple key->string store). Every method is defensively
// wrapped so a browser with storage disabled (private mode, quota) degrades to
// "no save" instead of throwing and taking the game down.
export class SaveManager {
    constructor(key = 'ouroboros-save-v1') {
        this.key = key;
        // Feature-detect once: some environments expose localStorage but throw on use.
        this.available = (() => {
            try {
                const t = '__ouro_probe__';
                window.localStorage.setItem(t, '1');
                window.localStorage.removeItem(t);
                return true;
            } catch (e) {
                return false;
            }
        })();
    }

    hasSave() {
        if (!this.available) return false;
        try { return window.localStorage.getItem(this.key) !== null; } catch (e) { return false; }
    }

    // Store a JSON-serializable object. Returns true on success.
    save(data) {
        if (!this.available) return false;
        try {
            window.localStorage.setItem(this.key, JSON.stringify(data));
            return true;
        } catch (e) {
            return false;
        }
    }

    // Return the parsed object, or null if there's nothing (or it's corrupt).
    load() {
        if (!this.available) return null;
        try {
            const raw = window.localStorage.getItem(this.key);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    clear() {
        if (!this.available) return;
        try { window.localStorage.removeItem(this.key); } catch (e) { /* ignore */ }
    }
}
