export class ShopManager {
    constructor(stateManager, audio) {
        this.state = stateManager;
        this.audio = audio;
        this.overlay = document.getElementById('shop-overlay');
        this.titleEl = document.getElementById('shop-title');
        this.itemsEl = document.getElementById('shop-items');

        // Vendors. Each has a title, an optional CSS class (Nibble's black-market skin),
        // and a data-driven item list — {key, name, price, desc, owned(), buy()}. The
        // rows are built into #shop-items on open(), so one overlay hosts both stalls and
        // adding an item is one entry here. Every lookup stays null-safe (a trimmed test
        // fixture can omit the container without crashing the GameEngine constructor).
        this.vendors = {
            bite: {
                title: "2-Bit's Node Shop",
                cls: null,
                items: [
                    { key: '1', name: 'Pivot Override', price: 10, desc: 'Press SHIFT for a safe 180 — reverse without eating your own tail.',
                      owned: () => this.state.upgrades.pivot, buy: () => { this.state.upgrades.pivot = true; } },
                    { key: '2', name: 'Data Compression', price: 15, desc: 'Apples give +2 Data instead of +1.',
                      owned: () => this.state.upgrades.dataCompression, buy: () => { this.state.upgrades.dataCompression = true; } },
                    { key: '3', name: 'Reinforced Segments', price: 25, desc: 'Hitting a Glitch costs 1 segment instead of 3.',
                      owned: () => this.state.upgrades.reinforcedSegments, buy: () => { this.state.upgrades.reinforcedSegments = true; } },
                    { key: '4', name: 'Topology Scanner', price: 40, desc: 'Sweep your body along a wall to reveal hidden doors. Longer sweeps light them longer.',
                      owned: () => this.state.upgrades.scanner, buy: () => { this.state.upgrades.scanner = true; } },
                    { key: '5', name: 'Crumple Buffer', price: 20, desc: 'Survive a crash: shed some data and crumple, instead of dying. (Without it, a hit sends you back to the start.)',
                      owned: () => this.state.upgrades.crumpleLevel > 0, buy: () => { this.state.upgrades.crumpleLevel = 1; } },
                ],
            },
            // Nibble's Black Market — cursed bargains. Everything here bends corruption
            // to your advantage; buying the Glitch Shunt is what flags you for Heur's
            // decontamination (telegraphed in her patter). DRAFT copy for the owner.
            nibble: {
                title: "Nibble's Black Market",
                cls: 'nibble',
                items: [
                    { key: '1', name: 'Glitch Shunt', price: 20, desc: "Your head PUSHES corruption instead of biting it. Shove a Glitch, herd it, park it somewhere load-bearing.",
                      owned: () => this.state.upgrades.corruptHandler, buy: () => { this.state.upgrades.corruptHandler = true; } },
                    { key: '2', name: 'Salvage Claws', price: 25, desc: "When corruption sheds your segments, some drop as re-collectible Data — scoop your own spilled mass back up.",
                      owned: () => this.state.upgrades.salvage, buy: () => { this.state.upgrades.salvage = true; } },
                    { key: '3', name: 'Scale Mods', price: 30, desc: "Cursed plating eats the FIRST Glitch bite in each room for free. One bite. Then it's hungry again.",
                      owned: () => this.state.upgrades.glitchWard, buy: () => { this.state.upgrades.glitchWard = true; } },
                ],
            },
        };

        this.btnClose = document.getElementById('btn-close-shop');
        this.onClose = null;
        this.onSpend = null;   // Data = segments: set by Game to shrink the body when you spend
        this.activeVendor = 'bite';
        this.rows = [];        // live {item, el, btn} for the open vendor

        this.bindEvents();
    }

    get items() {
        // Back-compat: the currently-active vendor's item list (the dev cheat / tests
        // call updateUI against "the shop").
        return this.vendors[this.activeVendor] ? this.vendors[this.activeVendor].items : [];
    }

    purchase(it) {
        if (!it || it.owned() || this.state.score < it.price) return;
        this.state.score -= it.price;
        if (this.onSpend) this.onSpend(it.price); // Data = segments: spending Data shrinks your body
        it.buy();
        this.audio.playBeep();
        this.updateUI();
    }

    bindEvents() {
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

    // Build the vendor's item rows into #shop-items (clearing any prior vendor's).
    _renderRows() {
        this.rows = [];
        if (!this.itemsEl) return;
        this.itemsEl.innerHTML = '';
        for (const item of this.items) {
            const row = document.createElement('div');
            row.className = 'shop-item';
            const text = document.createElement('div');
            text.className = 'shop-item-text';
            const name = document.createElement('span');
            name.innerText = `${item.name} (${item.price} Data)`;
            const desc = document.createElement('small');
            desc.innerText = item.desc;
            text.appendChild(name); text.appendChild(desc);
            const btn = document.createElement('button');
            btn.innerText = `[${item.key}] Buy`;
            btn.addEventListener('click', () => this.purchase(item));
            row.appendChild(text); row.appendChild(btn);
            this.itemsEl.appendChild(row);
            this.rows.push({ item, btn });
        }
    }

    // open(vendorId, onClose) — vendorId defaults to 'bite' for back-compat.
    open(vendorId, onCloseCallback) {
        if (typeof vendorId === 'function') { onCloseCallback = vendorId; vendorId = 'bite'; }
        this.activeVendor = this.vendors[vendorId] ? vendorId : 'bite';
        const v = this.vendors[this.activeVendor];
        this.onClose = onCloseCallback;
        if (this.titleEl) this.titleEl.innerText = v.title;
        if (this.overlay) {
            this.overlay.classList.toggle('nibble', v.cls === 'nibble');
        }
        this._renderRows();
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

        for (const { item, btn } of this.rows) {
            if (!btn) continue;
            if (item.owned()) {
                btn.innerText = 'OWNED';
                btn.disabled = true;
                btn.style.opacity = 0.5;
            } else {
                btn.innerText = `[${item.key}] Buy`;
                btn.disabled = this.state.score < item.price;
                btn.style.opacity = this.state.score < item.price ? 0.6 : 1;
            }
        }
    }
}
