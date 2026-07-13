/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateManager } from '../src/state/StateManager.js';

describe('StateManager', () => {
    let state;
    
    beforeEach(() => {
        state = new StateManager();
        // Mock DOM element for score update
        document.body.innerHTML = '<div id="score-value"></div>';
    });
    
    it('adds score correctly', () => {
        expect(state.score).toBe(0);
        state.addScore(5);
        expect(state.score).toBe(5);
    });
    
    it('resets score but keeps unlocks', () => {
        state.addScore(10);
        state.unlocked.ui = true;
        state.resetScore();
        
        expect(state.score).toBe(0);
        expect(state.unlocked.ui).toBe(true);
    });
});
