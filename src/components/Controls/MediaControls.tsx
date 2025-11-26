import React, { useState } from 'react';
import {
  MicrophoneIcon,
  VideoCameraIcon,
  PhoneIcon,
  ChatBubbleLeftIcon,
  EllipsisVerticalIcon,
} from '@heroicons/react/24/solid';
import {
  MicrophoneIcon as MicOffIcon,
  VideoCameraSlashIcon,
} from '@heroicons/react/24/outline';
import { DeviceSettingsPopup } from './DeviceSettingsPopup';
import { ScreenShareButton } from './ScreenShareButton';

interface MediaControlsProps {
  // Audio controls
  isAudioEnabled: boolean;
  audioLevel: number;
  onToggleAudio: () => void;

  // Video controls
  isVideoEnabled: boolean;
  onToggleVideo: () => void;

  // Screen share
  isScreenSharing: boolean;
  onToggleScreenShare: () => void;

  // Chat
  isChatOpen: boolean;
  messageCount: number;
  onToggleChat: () => void;

  // Device settings
  currentAudioDeviceId: string;
  currentVideoDeviceId: string;
  onAudioDeviceChange: (deviceId: string) => void;
  onVideoDeviceChange: (deviceId: string) => void;

  // Leave
  onLeave: () => void;
}

export const MediaControls: React.FC<MediaControlsProps> = ({
  isAudioEnabled,
  audioLevel,
  onToggleAudio,
  isVideoEnabled,
  onToggleVideo,
  isScreenSharing,
  onToggleScreenShare,
  isChatOpen,
  messageCount,
  onToggleChat,
  currentAudioDeviceId,
  currentVideoDeviceId,
  onAudioDeviceChange,
  onVideoDeviceChange,
  onLeave,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-center space-x-2 sm:space-x-3 px-2 sm:px-4 py-2 sm:py-2.5 bg-gray-800 border-t border-gray-700">
        {/* Audio toggle */}
        <button
        onClick={onToggleAudio}
        className={`relative p-2 sm:p-2.5 md:p-3 rounded-full transition-colors cursor-pointer touch-manipulation ${
          isAudioEnabled
            ? 'bg-gray-700 hover:bg-gray-600 active:bg-gray-600'
            : 'bg-red-600 hover:bg-red-700 active:bg-red-700 text-white'
        }`}
        title={isAudioEnabled ? 'Mute' : 'Unmute'}
      >
        {isAudioEnabled ? (
          <div className="relative w-4 h-4 sm:w-5 sm:h-5">
            {/* Base icon (gray) */}
            <MicrophoneIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
            {/* Filled icon (green) - clips from bottom based on audio level */}
            <div
              className="absolute inset-0 overflow-hidden transition-all duration-75"
              style={{
                clipPath: `inset(${100 - audioLevel * 100}% 0 0 0)`,
              }}
            >
              <MicrophoneIcon className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
            </div>
          </div>
        ) : (
          <MicOffIcon className="w-4 h-4 sm:w-5 sm:h-5" />
        )}
      </button>

      {/* Video toggle */}
      <button
        onClick={onToggleVideo}
        className={`p-2 sm:p-2.5 md:p-3 rounded-full transition-colors cursor-pointer touch-manipulation ${
          isVideoEnabled
            ? 'bg-gray-700 hover:bg-gray-600 active:bg-gray-600 text-white'
            : 'bg-red-600 hover:bg-red-700 active:bg-red-700 text-white'
        }`}
        title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
      >
        {isVideoEnabled ? (
          <VideoCameraIcon className="w-4 h-4 sm:w-5 sm:h-5" />
        ) : (
          <VideoCameraSlashIcon className="w-4 h-4 sm:w-5 sm:h-5" />
        )}
      </button>

      {/* Screen share toggle */}
      <ScreenShareButton
        isScreenSharing={isScreenSharing}
        onToggleScreenShare={onToggleScreenShare}
        className="hidden sm:flex"
      />

      {/* Chat toggle */}
      <button
        onClick={onToggleChat}
        className="relative p-2 sm:p-2.5 md:p-3 rounded-full bg-gray-700 hover:bg-gray-600 active:bg-gray-600 text-white transition-colors cursor-pointer touch-manipulation"
        title="Toggle chat"
      >
        <ChatBubbleLeftIcon className="w-4 h-4 sm:w-5 sm:h-5" />
        {!isChatOpen && messageCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 bg-red-600 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {messageCount > 9 ? '9+' : messageCount}
          </span>
        )}
      </button>

      {/* Device Settings */}
      <button
        onClick={() => setIsSettingsOpen(true)}
        className="p-2 sm:p-2.5 md:p-3 rounded-full bg-gray-700 hover:bg-gray-600 active:bg-gray-600 text-white transition-colors cursor-pointer touch-manipulation"
        title="Device settings"
      >
        <EllipsisVerticalIcon className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>

      {/* Leave button */}
      <button
        onClick={onLeave}
        className="p-2 sm:p-2.5 md:p-3 rounded-full bg-red-600 hover:bg-red-700 active:bg-red-700 text-white transition-colors cursor-pointer touch-manipulation ml-2 sm:ml-3"
        title="Leave meeting"
      >
        <PhoneIcon className="w-4 h-4 sm:w-5 sm:h-5 transform rotate-135" />
      </button>
    </div>

    {/* Device Settings Popup */}
    <DeviceSettingsPopup
      isOpen={isSettingsOpen}
      onClose={() => setIsSettingsOpen(false)}
      currentAudioDeviceId={currentAudioDeviceId}
      currentVideoDeviceId={currentVideoDeviceId}
      onAudioDeviceChange={onAudioDeviceChange}
      onVideoDeviceChange={onVideoDeviceChange}
    />
    </>
  );
};

export default MediaControls;
