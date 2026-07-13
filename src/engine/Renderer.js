export class Renderer {
    constructor(canvas, gridSize) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gridSize = gridSize;
    }
    
    draw(state, snake, apple) {
        // Clear screen (The Void)
        this.ctx.fillStyle = '#050505';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Neon Glow effect
        this.ctx.shadowBlur = 15;
        
        if (state.unlocked.borders) {
            this.ctx.strokeStyle = '#00ffcc';
            this.ctx.lineWidth = 4;
            this.ctx.shadowColor = '#00ffcc';
            this.ctx.strokeRect(2, 2, this.canvas.width - 4, this.canvas.height - 4);
        }
        
        // Draw Apple (Red Data)
        this.ctx.fillStyle = '#ff0055';
        this.ctx.shadowColor = '#ff0055';
        this.ctx.fillRect(apple.x + 2, apple.y + 2, this.gridSize - 4, this.gridSize - 4);
        
        // Draw Snake (White Program)
        this.ctx.fillStyle = '#ffffff';
        this.ctx.shadowColor = '#ffffff';
        for (const segment of snake.body) {
            this.ctx.fillRect(segment.x + 1, segment.y + 1, this.gridSize - 2, this.gridSize - 2);
        }
        
        // Reset shadow for performance on non-glowing elements if we add them
        this.ctx.shadowBlur = 0;
    }
}
