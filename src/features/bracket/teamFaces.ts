import { supabase } from '../../lib/supabase';
import { faceUrl } from '../registration/registrationApi';
import type { ParticipantRow } from '../../types';

export interface TeamVisuals {
  faceUrlByTeamId: Record<string, string[]>;
  labelByTeamId: Record<string, string>;
  memberNamesByTeamId: Record<string, string[]>;
}

export async function buildTeamVisuals(eventId: string): Promise<TeamVisuals> {
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, display_name')
    .eq('event_id', eventId);

  if (teamsError) throw teamsError;
  if (!teams?.length) {
    return { faceUrlByTeamId: {}, labelByTeamId: {}, memberNamesByTeamId: {} };
  }

  const teamIds = teams.map((t) => t.id);
  const { data: members, error: membersError } = await supabase
    .from('team_members')
    .select('team_id, participant_id')
    .in('team_id', teamIds);

  if (membersError) throw membersError;

  const participantIds = [...new Set((members ?? []).map((m) => m.participant_id))];
  let participants: ParticipantRow[] = [];
  if (participantIds.length > 0) {
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .in('id', participantIds);
    if (error) throw error;
    participants = data ?? [];
  }

  const participantById = new Map(participants.map((p) => [p.id, p]));
  const faceUrlByTeamId: Record<string, string[]> = {};
  const labelByTeamId: Record<string, string> = {};
  const memberNamesByTeamId: Record<string, string[]> = {};

  for (const team of teams) {
    const pids = (members ?? [])
      .filter((m) => m.team_id === team.id)
      .map((m) => m.participant_id);

    const names: string[] = [];
    const urls: string[] = [];
    for (const pid of pids) {
      const p = participantById.get(pid);
      if (!p) continue;
      names.push(p.name);
      const url = faceUrl(p.face_crop_path);
      if (url) urls.push(url);
    }

    faceUrlByTeamId[team.id] = urls;
    memberNamesByTeamId[team.id] = names;
    labelByTeamId[team.id] =
      team.display_name ?? names.join(' & ') ?? 'チーム';
  }

  return { faceUrlByTeamId, labelByTeamId, memberNamesByTeamId };
}

export async function buildFaceUrlMap(eventId: string): Promise<Record<string, string[]>> {
  const { faceUrlByTeamId } = await buildTeamVisuals(eventId);
  return faceUrlByTeamId;
}
