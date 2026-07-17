export class ShopManager {
    constructor(stateManager, audio) {
        this.state = stateManager;
        this.audio = audio;
        this.overlay = document.getElementById('shop-overlay');

        // Buttons
        this.btnBuyBrake = document.getElementById('btn-buy-brake');
        this.btnBuyHitchhiker = document.getElementById('btn-buy-hitchhiker');
        this.itemBuyHitchhiker = document.getElementById('item-buy-hitchhiker');
        this.btnBuyCompression = document.getElementById('btn-buy-compression');
        this.btnBuyArmor = document.getElementById('btn-buy-armor');
        this.btnBuySpeed = document.getElementById('btn-buy-speed');
        this.btnClose = document.getElementById('btn-close-shop');

        // Callbacks
        this.onClose = null;
        this.onSpeedUpgradeBought = null;

        this.bindEvents();
    }

    bindEvents() {
        // Guarded binding: any shop button may be absent (a trimmed test fixture, or a
        // future layout that drops an item). A missing element must never throw and
        // take the whole GameEngine constructor down with it.
        const on = (el, handler) => { if (el) el.addEventListener('click', handler); };

        on(this.btnBuyBrake, () => {
            if (this.state.score >= 10 && !this.state.upgrades.manualBrake) {
                this.state.score -= 10;
                this.state.upgrades.manualBrake = true;
                this.audio.playBeep();
                this.updateUI();
            }
        });

        on(this.btnBuyHitchhiker, () => {
            if (this.state.score >= 15 && !this.state.unlocked.tailRider) {
                this.state.score -= 15;
                this.state.unlocked.tailRider = true;
                this.audio.playBeep();
                this.updateUI();

                // When bought, close the shop and let Game.js handle attaching him
                this.close();
            }
        });

        on(this.btnBuyCompression, () => {
            if (this.state.score >= 15 && !this.state.upgrades.dataCompression) {
                this.state.score -= 15;
                this.state.upgrades.dataCompression = true;
                this.audio.playBeep();
                this.updateUI();
            }
        });

        on(this.btnBuyArmor, () => {
            if (this.state.score >= 25 && !this.state.upgrades.reinforcedSegments) {
                this.state.score -= 25;
                this.state.upgrades.reinforcedSegments = true;
                this.audio.playBeep();
                this.updateUI();
            }
        });

        on(this.btnBuySpeed, () => {
            if (this.state.score >= 30 && this.state.upgrades.speedLevel < 3) {
                this.state.score -= 30;
                this.state.upgrades.speedLevel++;
                this.audio.playBeep();
                this.updateUI();

                this.close();
                if (this.onSpeedUpgradeBought) {
                    this.onSpeedUpgradeBought(this.state.upgrades.speedLevel);
                }
            }
        });

        on(this.btnClose, () => {
            this.close();
        });

        window.addEventListener('keydown', (e) => {
            if (!this.overlay || this.overlay.classList.contains('hidden')) return;
            // While the shop is open it OWNS the keyboard: stop the event reaching the
            // later window listeners (pause toggle, movement buffering) — otherwise ESC
            // would close the shop AND immediately open the pause menu, and arrow keys
            // would queue a move that fires the instant you leave.
            e.stopImmediatePropagation();

            switch(e.key) {
                case '1':
                    if (this.btnBuyBrake) this.btnBuyBrake.click();
                    break;
                case 'h':
                case 'H':
                    if (this.itemBuyHitchhiker && !this.itemBuyHitchhiker.classList.contains('hidden') && this.btnBuyHitchhiker) {
                        this.btnBuyHitchhiker.click();
                    }
                    break;
                case '2':
                    if (this.btnBuyCompression) this.btnBuyCompression.click();
                    break;
                case '3':
                    if (this.btnBuyArmor) this.btnBuyArmor.click();
                    break;
                case '4':
                    if (this.btnBuySpeed) this.btnBuySpeed.click();
                    break;
                case 'Escape':
                    if (this.btnClose) this.btnClose.click();
                    break;
            }
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

        if (this.state.upgrades.manualBrake && this.btnBuyBrake) {
            this.btnBuyBrake.innerText = "OWNED";
            this.btnBuyBrake.disabled = true;
            this.btnBuyBrake.style.opacity = 0.5;
        }
        if (this.itemBuyHitchhiker) {
            if (this.state.upgrades.manualBrake && !this.state.unlocked.tailRider) {
                this.itemBuyHitchhiker.classList.remove('hidden');
            } else {
                this.itemBuyHitchhiker.classList.add('hidden');
            }
        }

        if (this.state.upgrades.dataCompression && this.btnBuyCompression) {
            this.btnBuyCompression.innerText = "OWNED";
            this.btnBuyCompression.disabled = true;
            this.btnBuyCompression.style.opacity = 0.5;
        }

        if (this.state.upgrades.reinforcedSegments && this.btnBuyArmor) {
            this.btnBuyArmor.innerText = "OWNED";
            this.btnBuyArmor.disabled = true;
            this.btnBuyArmor.style.opacity = 0.5;
        }

        if (this.btnBuySpeed) {
            if (this.state.upgrades.speedLevel >= 3) {
                this.btnBuySpeed.innerText = "MAX";
                this.btnBuySpeed.disabled = true;
                this.btnBuySpeed.style.opacity = 0.5;
            } else {
                this.btnBuySpeed.innerText = `Buy (Lvl ${this.state.upgrades.speedLevel}/3)`;
            }
        }
    }
}
