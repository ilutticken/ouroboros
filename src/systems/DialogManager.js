export class DialogManager {
    constructor() {
        this.container = document.createElement('div');
        this.container.id = 'dialog-overlay';
        this.container.className = 'hidden';
        
        this.textBox = document.createElement('div');
        this.textBox.id = 'dialog-text';
        
        this.continuePrompt = document.createElement('div');
        this.continuePrompt.id = 'dialog-prompt';
        this.continuePrompt.innerText = 'Press SPACE to continue';
        
        this.container.appendChild(this.textBox);
        this.container.appendChild(this.continuePrompt);
        // MOUNT ON THE BOARD, NOT THE BODY. #dialog-overlay is absolutely positioned in
        // percentages; parented to <body> (not a containing block) those resolved against
        // the VIEWPORT, so once the canvas became a fixed 1000x560 the box overhung the
        // play field on both sides and started above it. #game-wrapper IS the canvas box,
        // so the same percentages now describe the game. Falls back to body for any host
        // page without the cabinet.
        (document.getElementById('game-wrapper') || document.body).appendChild(this.container);
        
        this.currentDialog = null;
        this.lineIndex = 0;
        this.onComplete = null;
    }
    
    start(dialogLines, onComplete) {
        this.currentDialog = dialogLines;
        this.lineIndex = 0;
        this.onComplete = onComplete;
        this.container.classList.remove('hidden');
        this.showNextLine();
    }
    
    advance() {
        if (!this.currentDialog) return;
        
        this.lineIndex++;
        if (this.lineIndex < this.currentDialog.length) {
            this.showNextLine();
        } else {
            this.end();
        }
    }
    
    showNextLine() {
        this.textBox.innerText = this.currentDialog[this.lineIndex];
    }
    
    end() {
        this.container.classList.add('hidden');
        this.currentDialog = null;
        if (this.onComplete) this.onComplete();
    }
}
