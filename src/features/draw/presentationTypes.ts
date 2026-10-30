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
}

