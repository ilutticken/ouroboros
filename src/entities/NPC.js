export class NPC {
    constructor(x, y, gridSize, id, dialog) {
        this.x = x;
        this.y = y;
        this.gridSize = gridSize;
        this.id = id;
        this.dialog = dialog;
    }
    
    // An NPC might masquerade as something else, like an apple.
    // For now, it shares identical properties to an apple so the Renderer can draw it if it doesn't distinguish them yet.
    // To distinguish in the future, we could add a type flag.
}
