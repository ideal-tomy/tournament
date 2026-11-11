export interface DrawRevealParticipant {
  id: string;
  displayName: string;
  rating?: number | null;
  faceUrl: string | null;
}

export interface DrawPresentationData {
  sessionId: string;
  teamSize: number;
  participants: DrawRevealParticipant[];
  /** Parallel to grouped teams. Null keeps the member names only. */
  teamLabels?: (string | null)[];
}

