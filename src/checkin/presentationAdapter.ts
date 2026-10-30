import type { Participant } from './api';
export interface PresentationParticipant { id: string; displayName: string; rating: number | null; faceUrl: string }
export interface PresentationTeam { name: string; members: string[]; faces: string[]; participantIds: string[] }
export function toPresentationParticipant(participant: Participant): PresentationParticipant {
  if ((!['cf-rehearsal-001', 'cf-checkin-e2e-20261025', 'cf-flow-e2e-20261025', 'cf-pair-gates-e2e-20261025', 'cf-match-loop-e2e-20261025'].includes(participant.eventId)&&!/^cf-through-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(participant.eventId)) || participant.portraitSource !== 'uploaded' || !participant.name.trim()
    || !/^checkin-[a-f0-9-]{36}$/.test(participant.id)
    || participant.portraitUrl !== `/api/events/${participant.eventId}/participants/${participant.id}/portrait`
    || !['image/jpeg', 'image/png', 'image/webp'].includes(participant.portraitContentType)) {
    throw new Error('演出で利用できる参加者写真ではありません。受付で写真を登録してください。');
  }
  return { id: participant.id, displayName: participant.name, rating: participant.rating, faceUrl: participant.portraitUrl };
}
export function toPresentationTeam(participants: Participant[]): PresentationTeam {
  if (!participants.length || participants.length > 2) throw new Error('確認用チームは1〜2名を選択してください。');
  const members = participants.map(toPresentationParticipant);
  return { name: members.map(member => member.displayName).join(' ＆ '), members: members.map(member => member.displayName), faces: members.map(member => member.faceUrl), participantIds: members.map(member => member.id) };
}
