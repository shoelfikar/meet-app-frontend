import { VideoTile } from './VideoTile';
import type { MeetingParticipant } from '../../types';

interface VideoGridProps {
  participants: MeetingParticipant[];
  localParticipant?: MeetingParticipant | null;
}

export const VideoGrid: React.FC<VideoGridProps> = ({ participants, localParticipant }) => {
  const allParticipants = localParticipant
    ? [localParticipant, ...participants.filter((p) => p.user.id !== localParticipant.user.id)]
    : participants;

  const getGridClass = (count: number) => {
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-2';
    if (count <= 4) return 'grid-cols-2 grid-rows-2';
    if (count <= 6) return 'grid-cols-3 grid-rows-2';
    return 'grid-cols-4 grid-rows-auto';
  };

  return (
    <div className="h-full w-full p-4">
      <div
        className={`grid gap-4 h-full ${getGridClass(allParticipants.length)} auto-rows-fr`}
      >
        {allParticipants.map((participant) => (
          <VideoTile
            key={participant.user.id}
            participant={participant}
            isLocal={participant.user.id === localParticipant?.user.id}
          />
        ))}
      </div>

      {allParticipants.length === 0 && (
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-400 text-lg">Waiting for participants...</p>
        </div>
      )}
    </div>
  );
};
