import { describe, expect, it } from 'vitest';
import { postMatchPhase, postMatchTiming } from './timing';

describe('post-match presentation contract', () => {
  for (const mode of ['full', 'short', 'lite'] as const) {
    it(`${mode}: advancement precedes approach, impact and indefinite hold`, () => {
      const t = postMatchTiming(mode);
      expect(t.advance).toBeGreaterThan(0);
      expect(t.approach).toBeGreaterThan(t.advance + 0.6);
      expect(t.impact).toBeGreaterThan(t.approach);
      expect(t.hold).toBeGreaterThan(t.impact + 0.9);
      expect(postMatchPhase(t.impact - 0.01, mode)).toBe('OPPONENTS');
      expect(postMatchPhase(t.hold, mode)).toBe('NEXT MATCH HOLD');
      expect(postMatchPhase(t.hold + 3600, mode)).toBe('NEXT MATCH HOLD');
    });
  }
});
