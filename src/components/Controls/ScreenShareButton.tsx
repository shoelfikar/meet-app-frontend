import React from 'react';
import { ComputerDesktopIcon } from '@heroicons/react/24/solid';

interface ScreenShareButtonProps {
  isScreenSharing: boolean;
  onToggleScreenShare: () => void;
  disabled?: boolean;
  className?: string;
}

export const ScreenShareButton: React.FC<ScreenShareButtonProps> = ({
  isScreenSharing,
  onToggleScreenShare,
  disabled = false,
  className = '',
}) => {
  return (
    <button
      onClick={onToggleScreenShare}
      disabled={disabled}
      className={`p-2 sm:p-2.5 md:p-3 rounded-full transition-colors cursor-pointer touch-manipulation ${
        disabled
          ? 'bg-gray-600 cursor-not-allowed opacity-50'
          : isScreenSharing
          ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-700 text-white'
          : 'bg-gray-700 hover:bg-gray-600 active:bg-gray-600 text-white'
      } ${className}`}
      title={
        disabled
          ? 'Screen sharing unavailable'
          : isScreenSharing
          ? 'Stop sharing screen'
          : 'Share screen'
      }
    >
      <ComputerDesktopIcon className="w-4 h-4 sm:w-5 sm:h-5" />
    </button>
  );
};
