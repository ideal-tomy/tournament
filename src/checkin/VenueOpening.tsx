import { venueOpeningMedia } from './venueOpeningMedia';

export default function VenueOpening({ count, checkinClosed }: { count: number; checkinClosed: boolean }) {
  const media = venueOpeningMedia;
  return (
    <div className="venue-opening">
      {media.kind === 'video' ? (
        <video className="venue-opening-media" src={media.src} poster={media.poster} autoPlay muted loop playsInline />
      ) : (
        <img className="venue-opening-media" src={media.src} alt={media.alt} />
      )}
      <p className="venue-opening-status">登録 {count} 名 · 受付{checkinClosed ? '終了' : '中'}</p>
    </div>
  );
}
