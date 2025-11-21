import { useEffect, useRef } from 'react';
import type { MeetingParticipant } from '../../types';
import { MicrophoneIcon, VideoCameraIcon } from '@heroicons/react/24/solid';
import { MicrophoneIcon as MicOffIcon, VideoCameraSlashIcon } from '@heroicons/react/24/outline';

interface VideoTileProps {
  participant: MeetingParticipant;
  isLocal?: boolean;
}

export const VideoTile: React.FC<VideoTileProps> = ({ participant, isLocal = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  return (
    <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
      {!participant.is_video_on || !participant.stream ? (
        <div className="w-full h-full flex items-center justify-center bg-gray-700">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center mx-auto mb-2">
              <span className="text-2xl font-bold text-white">
                {participant.user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <p className="text-white font-medium">{participant.user.name}</p>
          </div>
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      )}

      {/* Participant info overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
        <div className="flex items-center justify-between">
          <span className="text-white text-sm font-medium truncate">
            {participant.user.name} {isLocal && '(You)'}
          </span>
          <div className="flex items-center space-x-2">
            {participant.is_muted ? (
              <MicOffIcon className="w-5 h-5 text-red-500" />
            ) : (
              <MicrophoneIcon className="w-5 h-5 text-white" />
            )}
            {!participant.is_video_on ? (
              <VideoCameraSlashIcon className="w-5 h-5 text-red-500" />
            ) : (
              <VideoCameraIcon className="w-5 h-5 text-white" />
            )}
          </div>
        </div>
      </div>

      {/* Host badge */}
      {participant.role === 'host' && (
        <div className="absolute top-3 left-3 bg-blue-600 text-white text-xs px-2 py-1 rounded">
          Host
        </div>
      )}
    </div>
  );
};
