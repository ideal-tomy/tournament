import { describe, expect, it } from 'vitest';
import { toVerticalDisplayChar, toVerticalDisplayChars } from './verticalText';

describe('verticalText', () => {
  it('伸ばし棒を縦棒に変換', () => {
    expect(toVerticalDisplayChar('ー')).toBe('｜');
    expect(toVerticalDisplayChars('トミー')).toEqual(['ト', 'ミ', '｜']);
  });
});
