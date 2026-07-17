export class ShopManager {
    constructor(stateManager, audio) {
        this.state = stateManager;
        this.audio = audio;
        this.overlay = document.getElementById('shop-overlay');

        // Each entry: element id, hotkey, price, and a can-buy / apply pair. Kept as
        // data so the shop is one list to edit, and every lookup is null-safe (a
        // trimmed test fixture or a future layout change can drop a button without
        // crashing the GameEngine constructor).
        this.items = [
            { id: 'btn-buy-pivot',       key: '1', price: 10, owned: () => this.state.upgrades.pivot,             buy: () => { this.state.upgrades.pivot = true; } },
            { id: 'btn-buy-compression', key: '2', price: 15, owned: () => this.state.upgrades.dataCompression,    buy: () => { this.state.upgrades.dataCompression = true; } },
            { id: 'btn-buy-armor',       key: '3', price: 25, owned: () => this.state.upgrades.reinforcedSegments, buy: () => { this.state.upgrades.reinforcedSegments = true; } },
            { id: 'btn-buy-scanner',     key: '4', price: 40, owned: () => this.state.upgrades.scanner,            buy: () => { this.state.upgrades.scanner = true; } },
            { id: 'btn-buy-rollback',    key: '5', price: 20, owned: () => this.state.upgrades.rollbackBuffer,     buy: () => { this.state.upgrades.rollbackBuffer = true; } },
        ];
        for (const it of this.items) it.el = document.getElementById(it.id);

        this.btnClose = document.getElementById('btn-close-shop');
        this.onClose = null;

        this.bindEvents();
    }

    purchase(it) {
        if (!it || it.owned() || this.state.score < it.price) return;
        this.state.score -= it.price;
        it.buy();
        this.audio.playBeep();
        this.updateUI();
    }

    bindEvents() {
        for (const it of this.items) {
            if (it.el) it.el.addEventListener('click', () => this.purchase(it));
        }
        if (this.btnClose) this.btnClose.addEventListener('click', () => this.close());

        window.addEventListener('keydown', (e) => {
            if (!this.overlay || this.overlay.classList.contains('hidden')) return;
            // While the shop is open it OWNS the keyboard: stop the event reaching the
            // later window listeners (pause toggle, movement buffering, pivot).
            e.stopImmediatePropagation();

            if (e.key === 'Escape') { this.close(); return; }
            const it = this.items.find(i => i.key === e.key);
            if (it) this.purchase(it);
        });
    }

    open(onCloseCallback) {
        this.onClose = onCloseCallback;
        this.updateUI();
        if (this.overlay) this.overlay.classList.remove('hidden');
    }

    close() {
        if (this.overlay) this.overlay.classList.add('hidden');
        // Drop focus off any (now-hidden) shop button so a stray Space/Enter can't
        // re-click it from the game, and null the callback so it can't double-fire.
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }
        const cb = this.onClose;
        this.onClose = null;
        if (cb) cb();
    }

    updateUI() {
        const scoreEl = document.getElementById('score-value');
        if (scoreEl) scoreEl.innerText = this.state.score.toString();

        for (const it of this.items) {
            if (!it.el) continue;
            if (it.owned()) {
                it.el.innerText = 'OWNED';
                it.el.disabled = true;
                it.el.style.opacity = 0.5;
            } else {
                it.el.disabled = this.state.score < it.price;
                it.el.style.opacity = this.state.score < it.price ? 0.6 : 1;
            }
        }
    }
}
