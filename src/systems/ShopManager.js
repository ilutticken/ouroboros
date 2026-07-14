export class ShopManager {
    constructor(stateManager, audio) {
        this.state = stateManager;
        this.audio = audio;
        this.overlay = document.getElementById('shop-overlay');
        
        // Buttons
        this.btnBuyBrake = document.getElementById('btn-buy-brake');
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
        this.btnBuyBrake.addEventListener('click', () => {
            if (this.state.score >= 10 && !this.state.upgrades.manualBrake) {
                this.state.score -= 10;
                this.state.upgrades.manualBrake = true;
                this.audio.playBeep();
                this.updateUI();
            }
        });
        
        this.btnBuyCompression.addEventListener('click', () => {
            if (this.state.score >= 15 && !this.state.upgrades.dataCompression) {
                this.state.score -= 15;
                this.state.upgrades.dataCompression = true;
                this.audio.playBeep();
                this.updateUI();
            }
        });
        
        this.btnBuyArmor.addEventListener('click', () => {
            if (this.state.score >= 25 && !this.state.upgrades.reinforcedSegments) {
                this.state.score -= 25;
                this.state.upgrades.reinforcedSegments = true;
                this.audio.playBeep();
                this.updateUI();
            }
        });
        
        this.btnBuySpeed.addEventListener('click', () => {
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
        
        this.btnClose.addEventListener('click', () => {
            this.close();
        });
        
        window.addEventListener('keydown', (e) => {
            if (this.overlay.classList.contains('hidden')) return;
            
            switch(e.key) {
                case '1':
                    this.btnBuyBrake.click();
                    break;
                case '2':
                    this.btnBuyCompression.click();
                    break;
                case '3':
                    this.btnBuyArmor.click();
                    break;
                case '4':
                    this.btnBuySpeed.click();
                    break;
                case 'Escape':
                    this.btnClose.click();
                    break;
            }
        });
    }
    
    open(onCloseCallback) {
        this.onClose = onCloseCallback;
        this.updateUI();
        this.overlay.classList.remove('hidden');
    }
    
    close() {
        this.overlay.classList.add('hidden');
        if (this.onClose) this.onClose();
    }
    
    updateUI() {
        document.getElementById('score-value').innerText = this.state.score.toString();
        
        if (this.state.upgrades.manualBrake) {
            this.btnBuyBrake.innerText = "OWNED";
            this.btnBuyBrake.disabled = true;
            this.btnBuyBrake.style.opacity = 0.5;
        }
        
        if (this.state.upgrades.dataCompression) {
            this.btnBuyCompression.innerText = "OWNED";
            this.btnBuyCompression.disabled = true;
            this.btnBuyCompression.style.opacity = 0.5;
        }
        
        if (this.state.upgrades.reinforcedSegments) {
            this.btnBuyArmor.innerText = "OWNED";
            this.btnBuyArmor.disabled = true;
            this.btnBuyArmor.style.opacity = 0.5;
        }
        
        if (this.state.upgrades.speedLevel >= 3) {
            this.btnBuySpeed.innerText = "MAX";
            this.btnBuySpeed.disabled = true;
            this.btnBuySpeed.style.opacity = 0.5;
        } else {
            this.btnBuySpeed.innerText = `Buy (Lvl ${this.state.upgrades.speedLevel}/3)`;
        }
    }
}
