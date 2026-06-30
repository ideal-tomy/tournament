import { supabase } from '../../lib/supabase';
import type { ParticipantRow } from '../../types';

export function faceUrl(path: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from('participant-faces').getPublicUrl(path).data.publicUrl;
}

export async function listParticipants(eventId: string): Promise<ParticipantRow[]> {
  const { data, error } = await supabase
    .from('participants')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function addParticipant(
  eventId: string,
  name: string,
  rating: number,
  photo: Blob,
  face: Blob,
): Promise<string> {
  const { data: row, error } = await supabase
    .from('participants')
    .insert({ event_id: eventId, name: name.trim(), rating })
    .select()
    .single();

  if (error || !row) throw error ?? new Error('参加者の登録に失敗しました');

  const base = `${eventId}/${row.id}.jpg`;
  const photoRes = await supabase.storage
    .from('participant-photos')
    .upload(base, photo, { upsert: true, contentType: 'image/jpeg' });
  if (photoRes.error) throw photoRes.error;

  const faceRes = await supabase.storage
    .from('participant-faces')
    .upload(base, face, { upsert: true, contentType: 'image/jpeg' });
  if (faceRes.error) throw faceRes.error;

  const { error: updateError } = await supabase
    .from('participants')
    .update({ photo_path: base, face_crop_path: base })
    .eq('id', row.id);

  if (updateError) throw updateError;
  return row.id;
}

export async function updateParticipantPhotos(
  participantId: string,
  eventId: string,
  photo: Blob,
  face: Blob,
  name?: string,
  rating?: number,
): Promise<void> {
  const base = `${eventId}/${participantId}.jpg`;

  const photoRes = await supabase.storage
    .from('participant-photos')
    .upload(base, photo, { upsert: true, contentType: 'image/jpeg' });
  if (photoRes.error) throw photoRes.error;

  const faceRes = await supabase.storage
    .from('participant-faces')
    .upload(base, face, { upsert: true, contentType: 'image/jpeg' });
  if (faceRes.error) throw faceRes.error;

  const patch: {
    photo_path: string;
    face_crop_path: string;
    name?: string;
    rating?: number;
  } = {
    photo_path: base,
    face_crop_path: base,
  };
  if (name != null) patch.name = name.trim();
  if (rating != null) patch.rating = rating;

  const { error } = await supabase
    .from('participants')
    .update(patch)
    .eq('id', participantId);

  if (error) throw error;
}

export async function deleteParticipant(participant: ParticipantRow): Promise<void> {
  if (participant.photo_path) {
    await supabase.storage.from('participant-photos').remove([participant.photo_path]);
  }
  if (participant.face_crop_path) {
    await supabase.storage.from('participant-faces').remove([participant.face_crop_path]);
  }

  const { error } = await supabase
    .from('participants')
    .delete()
    .eq('id', participant.id);

  if (error) throw error;
}

export async function updateParticipantRating(
  participantId: string,
  rating: number,
): Promise<void> {
  const { error } = await supabase
    .from('participants')
    .update({ rating })
    .eq('id', participantId);
  if (error) throw error;
}
