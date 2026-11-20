import { describe, expect, it } from 'vitest';
import { courtStandbyLabel } from './courtStandby';

describe('courtStandbyLabel', () => {
  it('次の試合がないときと、相手待ちを分ける', () => {
    expect(courtStandbyLabel(null)).toBe('次の試合はありません');
    expect(courtStandbyLabel('大会終了')).toBe('次の試合はありません');
    expect(courtStandbyLabel('グランドファイナルは台には載せません')).toBe('次の試合はありません');
    expect(courtStandbyLabel('対戦相手の確定待ち')).toBe('対戦相手の確定待ち');
    expect(courtStandbyLabel('もう一方の結果が出ると、対戦相手が決まる')).toBe('対戦相手の確定待ち');
    expect(courtStandbyLabel('出場チームが別の台で試合中、または確保済み')).toBe('出場チームが別の台で試合中、または確保済み');
  });
});
