import { venueOpeningMedia, type VenueOpeningMedia } from './venueOpeningMedia';
import { formatLabel } from './eventFormat';

/** The event's own standby image when one was posted; otherwise the shared default. */
export function openingMedia(eventId: string | undefined, openingVersion: string | null | undefined, title?: string): VenueOpeningMedia {
  if (!eventId || !openingVersion) return venueOpeningMedia;
  const query = new URLSearchParams({ run: eventId, v: openingVersion });
  return { kind: 'image', src: `/api/events/${eventId}/opening?${query}`, alt: title || '大会の待機画像' };
}

export default function VenueOpening({ count, checkinClosed, eventId, openingVersion, format, title }: {
  count: number; checkinClosed: boolean; eventId?: string; openingVersion?: string | null; format?: string; title?: string;
}) {
  const media = openingMedia(eventId, openingVersion, title);
  return (
    <div className="venue-opening">
      {media.kind === 'video' ? (
        <video className="venue-opening-media" src={media.src} poster={media.poster} autoPlay muted loop playsInline />
      ) : (
        <img key={media.src} className="venue-opening-media" src={media.src} alt={media.alt} />
      )}
      <p className="venue-opening-status">{[formatLabel(format), `登録 ${count} 名 · 受付${checkinClosed ? '終了' : '中'}`].filter(Boolean).join(' · ')}</p>
    </div>
  );
}
