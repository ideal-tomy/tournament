import { useState } from 'react';
import CameraCapture from './CameraCapture';
import ParticipantList from './ParticipantList';
import { useParticipants } from './useParticipants';
import type { ParticipantRow } from '../../types';

interface RegistrationPanelProps {
  eventId: string;
}

export default function RegistrationPanel({ eventId }: RegistrationPanelProps) {
  const { participants, loading, refresh } = useParticipants(eventId);
  const [retakeTarget, setRetakeTarget] = useState<ParticipantRow | null>(null);

  function handleDone() {
    setRetakeTarget(null);
    void refresh();
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-bold mb-3">参加者登録</h2>
        <CameraCapture
          eventId={eventId}
          retakeTarget={
            retakeTarget
              ? {
                  id: retakeTarget.id,
                  name: retakeTarget.name,
                  rating: retakeTarget.rating,
                }
              : null
          }
          onDone={handleDone}
          onCancelRetake={() => setRetakeTarget(null)}
        />
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">
            登録済み ({participants.length}名)
          </h2>
        </div>
        <ParticipantList
          participants={participants}
          loading={loading}
          onRetake={setRetakeTarget}
          onDeleted={() => void refresh()}
          onUpdated={() => void refresh()}
        />
      </section>
    </div>
  );
}
