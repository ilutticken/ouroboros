import { describe, it, expect, beforeEach } from 'vitest';
import { Snake } from '../src/entities/Snake.js';

describe('Snake', () => {
    let snake;
    
    beforeEach(() => {
        snake = new Snake(100, 100, 20);
    });
    
    it('initializes correctly', () => {
        expect(snake.body.length).toBe(1);
        expect(snake.head).toEqual({ x: 100, y: 100 });
    });
    
    it('moves correctly and wraps without borders', () => {
        // Move right
        snake.move({ x: 20, y: 0 }, 400, 400, false);
        expect(snake.head).toEqual({ x: 120, y: 100 });
        
        // Wrap around right edge
        snake = new Snake(380, 100, 20);
        snake.move({ x: 20, y: 0 }, 400, 400, false);
        expect(snake.head).toEqual({ x: 0, y: 100 });
    });
    
    it('dies on borders when unlocked', () => {
        snake = new Snake(380, 100, 20);
        const alive = snake.move({ x: 20, y: 0 }, 400, 400, true);
        expect(alive).toBe(false);
    });
    
    it('detects self collision', () => {
        snake.body = [
            { x: 100, y: 100 },
            { x: 80, y: 100 },
            { x: 80, y: 80 },
            { x: 100, y: 80 },
            { x: 100, y: 100 } // Head collided with tail
        ];
        expect(snake.checkSelfCollision()).toBe(true);
    });
});
