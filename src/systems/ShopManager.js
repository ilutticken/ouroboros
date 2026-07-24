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
                      owned: () => this.state.upgrades.crumpleLevel > 0, buy: () => { this.state.upgrades.crumpleLevel = Math.max(this.state.upgrades.crumpleLevel, 1); } },
                    // Mine-gated stock tier: appears once the Data Mines run >= 3 miners
                    // (2-Bit doesn't ask where the ore comes from). The economy's second
                    // income multiplier. (DRAFT desc.)
                    { key: '6', name: 'Data Compression II', price: 60, desc: 'Mine-grade packing: apples give +3 Data. (Sourced... ethically-adjacent.)',
                      avail: () => (this.state.unlocked.refugeesMined || 0) >= 3,
                      owned: () => this.state.upgrades.dataCompression2, buy: () => { this.state.upgrades.dataCompression2 = true; } },
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

        // QUANTCY'S TRUST — the Wilds bank. Deposits are REPEATABLE rows (owned() only
        // trips at the vault cap) that run through the normal purchase/spend path, so
        // Data = segments holds: banking Data physically shrinks you. The vault cap and
        // interest both grow with FREED refugees (the light-side synergy). All DRAFT copy.
        const st = this.state; // closured for the dynamic desc getters below
        const vaultCap = () => 100 + 50 * (st.unlocked.refugeesFreed || 0);
        const mkDeposit = (key, amt) => ({
            key, name: `Deposit ${amt}`, price: amt,
            get desc() { return `Shed ${amt} Data into the vault. It compounds while you roam. (Vault cap: ${vaultCap()}.)`; },
            owned: () => (st.unlocked.quantcyPrincipal || 0) + amt > vaultCap(),
            ownedLabel: 'VAULT FULL',
            buy: () => { st.unlocked.quantcyPrincipal = (st.unlocked.quantcyPrincipal || 0) + amt; },
        });
        this.vendors.quantcy = {
            title: "Quantcy's Trust",
            cls: null,
            items: [
                mkDeposit('1', 10),
                mkDeposit('2', 25),
                mkDeposit('3', 50),
                {
                    key: '4', name: 'Withdraw everything', price: 0,
                    get desc() {
                        const p = st.unlocked.quantcyPrincipal || 0, y = Math.floor(st.unlocked.quantcyYield || 0);
                        const pending = Math.floor(st.unlocked.quantcyPayout || 0);
                        const full = p > 0 && (st.unlocked.quantcyYield || 0) >= p ? ' VAULT FULL — collect!' : '';
                        return `Held: ${p} principal + ${y} yield.${pending ? ` (${pending} still on the floor.)` : ''}${full} Withdrawn Data lands HERE as motes — carry it home alive.`;
                    },
                    owned: () => Math.floor((st.unlocked.quantcyPrincipal || 0) + (st.unlocked.quantcyYield || 0)) < 1,
                    ownedLabel: 'EMPTY',
                    buy: () => { if (this.onQuantcyWithdraw) this.onQuantcyWithdraw(); },
                },
            ],
        };

        // HYDRATIA'S STALL — the autosave machinery (Localhost, post-catch). Each item is
        // a real code delta in Game.js (autoCommit hooks); all write her SHADOW buffer,
        // never Cache's manual file. All DRAFT copy.
        this.vendors.hydratia = {
            title: "Hydratia's Shadow Copies",
            cls: null,
            items: [
                { key: '1', name: 'Auto-Commit', price: 20, desc: 'She quietly backs up your progress every time you reach a safe zone. Restore it from the boot menu ([R] when her copy is newer).',
                  owned: () => this.state.unlocked.autosaveSafe, buy: () => { this.state.unlocked.autosaveSafe = true; } },
                { key: '2', name: 'Last Breath', price: 25, desc: 'She snapshots your progress the instant before a death wipes the run. Progress only — carried Data still dies with you.',
                  owned: () => this.state.unlocked.autosaveDeath, buy: () => { this.state.unlocked.autosaveDeath = true; } },
                { key: '3', name: 'Frequent Commit', price: 30, desc: 'Every sector you cross, she commits. Constant. Silent. Thorough.',
                  owned: () => this.state.unlocked.autosaveEvery, buy: () => { this.state.unlocked.autosaveEvery = true; } },
            ],
        };

        this.btnClose = document.getElementById('btn-close-shop');
        this.onClose = null;
        this.onSpend = null;   // Data = segments: set by Game to shrink the body when you spend
        this.onQuantcyWithdraw = null; // set by Game: converts the vault to motes in his room
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
        // avail() must gate the PURCHASE, not just the shelf: the keydown handler finds
        // items in the raw vendor list, so a hidden (mine-gated) row was silently
        // buyable by pressing its number key.
        if (!it || (it.avail && !it.avail()) || it.owned() || this.state.score < it.price) return;
        this.state.score -= it.price;
        if (this.onSpend) this.onSpend(it.price); // Data = segments: spending Data shrinks your body
        it.buy();
        this.audio.playBeep();
        // Vendors with LIVE row text (Quantcy's holdings) re-render so the numbers are
        // honest immediately, not on the next open. (A withdraw closes the overlay first;
        // re-rendering a hidden overlay is harmless.)
        if (this.activeVendor === 'quantcy') this._renderRows();
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
            if (item.avail && !item.avail()) continue; // gated stock (e.g. mine tiers) stays off the shelf
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
                btn.innerText = item.ownedLabel || 'OWNED'; // repeatable rows label their own cap ('VAULT FULL', 'EMPTY')
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
