import { describe, expect, it } from 'vitest';
import { repairStoredPng } from './portraitCache';

/** 96×96 PNG whose every chunk CRC is preceded by four 0x00 bytes. Browsers cannot decode it. */
const stored = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAIAAAAAAAAAbfrgbwAAAV1JREFUeJzt2sENg0AQQ1FKouoUllOOKSEdLLA7tifwJRcw/0k5QNhe+84G2+IXNB9AAAEEEECNBxBAAAEEUOMBBBBAAAHUeAAB9O9A7893vIcCHbo0kcoATeikjNxA0zQpJitQiY7ZyAdUqOM0MgGV69iMAGoAJNLxGMmBpDoGI4AA6gxk0FEbAQQQQAABBBBAAAEEEED9gHgWAwggNRBvFJNGhssB6gHE/2JuI9vN/MSiQCIXp5QKyEajZioGirhIpSqB4i4KoxqgOIeOaRUoTqBmWgKKlxuM5oHizR6jSaB4rc1oBije6TS6DBQvNBtdA4q3+Y0uAMWrIkZngeI9KaNTQPGSoBFAy0DxhqwRQGtA8evjRgABpAOK393BCCCAAAIIoAYDCCCAAAKo8QACyA/0HKOBAEAASYGeYDTOB2gZ6N5Gh+0AVQDd1ehMOF931AHdyeh8Ml+YHewH7BckRQAAAAAf/b34AAAAAElFTkQAAAAArkJggg==',
  'base64',
);

describe('repairStoredPng', () => {
  it('moves a zero placeholder out of the way so the real CRC sits on the chunk', () => {
    const fixed = repairStoredPng(stored);
    expect(fixed).not.toBe(stored);
    expect(fixed.length).toBe(stored.length - 12);
    expect([...fixed.subarray(29, 33)]).toEqual([0x6d, 0xfa, 0xe0, 0x6f]);
    expect(String.fromCharCode(...fixed.subarray(fixed.length - 8, fixed.length - 4))).toBe('IEND');
  });

  it('leaves a PNG whose CRC is already in place unchanged', () => {
    const fixed = repairStoredPng(stored);
    expect(repairStoredPng(fixed)).toBe(fixed);
  });
});
