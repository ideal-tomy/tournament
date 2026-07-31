import { describe, expect, it } from 'vitest';
import { canTransition, SCENES } from './sceneMachine';

describe('sceneMachine', () => {
  it('defines 10 scenes', () => {
    expect(SCENES).toHaveLength(10);
  });

  it('allows result → bracket', () => {
    expect(canTransition('result', 'bracket')).toBe(true);
  });

  it('rejects vs_card → result', () => {
    expect(canTransition('vs_card', 'result')).toBe(false);
  });

  it('force allows any', () => {
    expect(canTransition('vs_card', 'result', true)).toBe(true);
  });
});
