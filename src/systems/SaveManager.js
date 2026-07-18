// Persistence via localStorage (the Candy Box / A-Dark-Room approach — NOT cookies:
// bigger, client-only, a simple key->string store). Every method is defensively
// wrapped so a browser with storage disabled (private mode, quota) degrades to
// "no save" instead of throwing and taking the game down.
//
// Three independent SAVE FILES (slots 1..3). A legacy single-key save from before this
// system is migrated into slot 1 on first construction so nobody loses progress.
export class SaveManager {
    constructor(prefix = 'ouroboros-save-v1') {
        this.prefix = prefix;
        this.slotCount = 3;
        this.cameoKey = 'ouroboros-cameo-seen'; // global (not per-slot) one-time title cameo
        this.settingsKey = 'ouroboros-settings'; // global a11y/player settings (volume, motion)
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
        this._migrateLegacy();
    }

    _slotKey(slot) { return `${this.prefix}-s${slot}`; }

    // Move a pre-slots single-key save into slot 1 (once), so an existing player keeps
    // their progress when this update lands.
    _migrateLegacy() {
        if (!this.available) return;
        try {
            const legacy = window.localStorage.getItem(this.prefix);
            if (legacy !== null && window.localStorage.getItem(this._slotKey(1)) === null) {
                window.localStorage.setItem(this._slotKey(1), legacy);
                window.localStorage.removeItem(this.prefix);
            }
        } catch (e) { /* ignore */ }
    }

    hasSave(slot) {
        if (!this.available) return false;
        try { return window.localStorage.getItem(this._slotKey(slot)) !== null; } catch (e) { return false; }
    }

    anySave() {
        for (let s = 1; s <= this.slotCount; s++) if (this.hasSave(s)) return true;
        return false;
    }

    // Store a JSON-serializable object into a slot. Stamps savedAt for the file summary.
    // Returns true on success.
    save(slot, data) {
        if (!this.available) return false;
        try {
            const blob = { ...data, savedAt: Date.now() };
            window.localStorage.setItem(this._slotKey(slot), JSON.stringify(blob));
            return true;
        } catch (e) {
            return false;
        }
    }

    // Return the parsed object for a slot, or null if empty / corrupt.
    load(slot) {
        if (!this.available) return null;
        try {
            const raw = window.localStorage.getItem(this._slotKey(slot));
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    clear(slot) {
        if (!this.available) return;
        try { window.localStorage.removeItem(this._slotKey(slot)); } catch (e) { /* ignore */ }
    }

    // Wipe every slot (and the cameo flag) — used to reset from a truly clean slate.
    clearAll() {
        for (let s = 1; s <= this.slotCount; s++) this.clear(s);
        if (!this.available) return;
        try { window.localStorage.removeItem(this.cameoKey); } catch (e) { /* ignore */ }
    }

    // File-select metadata for every slot: { slot, exists, meta, savedAt }. `meta` is the
    // display summary the save wrote (place reached, mods owned); null when empty.
    slots() {
        const out = [];
        for (let s = 1; s <= this.slotCount; s++) {
            const d = this.load(s);
            out.push({ slot: s, exists: !!d, meta: d ? (d.meta || null) : null, savedAt: d ? (d.savedAt || null) : null });
        }
        return out;
    }

    // Global one-time flag for Cache's title-screen walk-on cameo (independent of slots,
    // so it plays exactly once across all files).
    hasCameoSeen() {
        if (!this.available) return false;
        try { return window.localStorage.getItem(this.cameoKey) === '1'; } catch (e) { return false; }
    }
    markCameoSeen() {
        if (!this.available) return;
        try { window.localStorage.setItem(this.cameoKey, '1'); } catch (e) { /* ignore */ }
    }

    // Global player settings (volume / mute / reduce-motion) — independent of the save
    // slots, so preferences persist across New Game / Load and are NOT wiped by clearAll.
    loadSettings() {
        if (!this.available) return null;
        try { const raw = window.localStorage.getItem(this.settingsKey); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
    }
    saveSettings(obj) {
        if (!this.available) return;
        try { window.localStorage.setItem(this.settingsKey, JSON.stringify(obj)); } catch (e) { /* ignore */ }
    }
}
