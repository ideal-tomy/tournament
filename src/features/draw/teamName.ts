/** Venue label only. Pairing still uses the member names joined the same way. */
export const VENUE_TEAM_NAME_MAX = 16;

export function generatedTeamName(memberNames: string[]) {
  return memberNames.join(' & ');
}

/** Null when the stored name is still the generated member list. */
export function venueTeamName(stored: string, memberNames: string[]) {
  const name = stored.trim();
  return name && name !== generatedTeamName(memberNames) ? name : null;
}
