import { useState } from 'react';
import {
  MicrophoneIcon,
  VideoCameraIcon,
  PhoneIcon,
  ChatBubbleLeftIcon,
  ComputerDesktopIcon,
} from '@heroicons/react/24/solid';
import {
  MicrophoneIcon as MicOffIcon,
  VideoCameraSlashIcon,
} from '@heroicons/react/24/outline';
import { useMedia } from '../../hooks';
import { useChatStore } from '../../store';
import clsx from 'clsx';

interface MediaControlsProps {
  onLeave?: () => void;
  onToggleChat?: () => void;
}

export const MediaControls: React.FC<MediaControlsProps> = ({ onLeave, onToggleChat }) => {
  const { isAudioEnabled, isVideoEnabled, isScreenSharing, toggleAudio, toggleVideo, startScreenShare, stopScreenShare } = useMedia();
  const { unreadCount, isChatOpen } = useChatStore();

  const handleToggleAudio = () => {
    toggleAudio();
  };

  const handleToggleVideo = () => {
    toggleVideo();
  };

  const handleToggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        stopScreenShare();
      } else {
        await startScreenShare();
      }
    } catch (error) {
      console.error('Failed to toggle screen share:', error);
    }
  };

  const handleLeave = () => {
    if (confirm('Are you sure you want to leave the meeting?')) {
      onLeave?.();
    }
  };

  return (
    <div className="flex items-center justify-center space-x-4 p-4 bg-gray-800 border-t border-gray-700">
      {/* Audio toggle */}
      <button
        onClick={handleToggleAudio}
        className={clsx(
          'p-4 rounded-full transition-colors',
          isAudioEnabled
            ? 'bg-gray-700 hover:bg-gray-600 text-white'
            : 'bg-red-600 hover:bg-red-700 text-white'
        )}
        title={isAudioEnabled ? 'Mute' : 'Unmute'}
      >
        {isAudioEnabled ? (
          <MicrophoneIcon className="w-6 h-6" />
        ) : (
          <MicOffIcon className="w-6 h-6" />
        )}
      </button>

      {/* Video toggle */}
      <button
        onClick={handleToggleVideo}
        className={clsx(
          'p-4 rounded-full transition-colors',
          isVideoEnabled
            ? 'bg-gray-700 hover:bg-gray-600 text-white'
            : 'bg-red-600 hover:bg-red-700 text-white'
        )}
        title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
      >
        {isVideoEnabled ? (
          <VideoCameraIcon className="w-6 h-6" />
        ) : (
          <VideoCameraSlashIcon className="w-6 h-6" />
        )}
      </button>

      {/* Screen share toggle */}
      <button
        onClick={handleToggleScreenShare}
        className={clsx(
          'p-4 rounded-full transition-colors',
          isScreenSharing
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-gray-700 hover:bg-gray-600 text-white'
        )}
        title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
      >
        <ComputerDesktopIcon className="w-6 h-6" />
      </button>

      {/* Chat toggle */}
      <button
        onClick={onToggleChat}
        className="relative p-4 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors"
        title="Toggle chat"
      >
        <ChatBubbleLeftIcon className="w-6 h-6" />
        {unreadCount > 0 && !isChatOpen && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Leave button */}
      <button
        onClick={handleLeave}
        className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors ml-4"
        title="Leave meeting"
      >
        <PhoneIcon className="w-6 h-6 transform rotate-135" />
      </button>
    </div>
  );
};
