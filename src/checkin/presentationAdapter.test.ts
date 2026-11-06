import { describe, expect, it } from 'vitest';
import { ratedName, toPresentationParticipant, toPresentationTeam } from './presentationAdapter';
import type { Participant } from './api';
const participant: Participant = {
  id: 'checkin-12345678-1234-4123-8123-123456789abc', eventId: 'cf-rehearsal-001', name: '登録した本人', rating: 5,
  portraitUrl: '/api/events/cf-rehearsal-001/participants/checkin-12345678-1234-4123-8123-123456789abc/portrait', photoUrl: '/api/participants/checkin-12345678-1234-4123-8123-123456789abc/photo', portraitContentType: 'image/jpeg', portraitSource: 'uploaded', createdAt: '', version: 1, updatedAt: '',
};
describe('participant to presentation boundary', () => {
  it('passes the exact stored participant identity and authenticated portrait URL to scenes', () => {
    expect(toPresentationParticipant(participant)).toEqual({ id: participant.id, displayName: '登録した本人（Rt.5）', rating: 5, faceUrl: participant.portraitUrl });
    expect(toPresentationTeam([participant])).toEqual({ name: '登録した本人（Rt.5）', members: ['登録した本人（Rt.5）'], faces: [participant.portraitUrl], participantIds: [participant.id] });
  });
  it('shows the name alone when no rating was registered', () => {
    expect(toPresentationParticipant({ ...participant, rating: null }).displayName).toBe('登録した本人');
    expect(ratedName({ name: 'A', rating: 12.5 })).toBe('A（Rt.12.5）');
  });
  it.each([
    { portraitSource: 'automated-test' as const }, { eventId: 'live-event' }, { portraitUrl: 'blob:temporary-image' }, { portraitUrl: '/images/test01.png' }, { portraitUrl: 'https://example.invalid/photo.jpg' }, { portraitContentType: 'text/html' },
  ])('rejects fixture, temporary or mismatched image inputs instead of falling back: %j', change => {
    expect(() => toPresentationParticipant({ ...participant, ...change })).toThrow();
  });
  it('does not generate a team from absent real data', () => { expect(() => toPresentationTeam([])).toThrow(); });
});
