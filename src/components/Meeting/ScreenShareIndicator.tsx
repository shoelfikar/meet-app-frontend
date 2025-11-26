import React from 'react';
import { ComputerDesktopIcon } from '@heroicons/react/24/solid';

interface ScreenShareIndicatorProps {
  presenterName: string;
  isLocalShare: boolean;
  onStopSharing?: () => void;
  onMinimize?: () => void;
}

export const ScreenShareIndicator: React.FC<ScreenShareIndicatorProps> = ({
  presenterName,
  isLocalShare,
  onStopSharing,
  onMinimize,
}) => {
  return (
    <div className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg shadow-lg flex items-center justify-between space-x-3">
      <div className="flex items-center space-x-2 flex-1 min-w-0">
        <ComputerDesktopIcon className="w-5 h-5 flex-shrink-0" />
        <span className="text-sm sm:text-base font-medium truncate">
          {isLocalShare ? 'You are presenting' : `${presenterName} is presenting`}
        </span>
      </div>

      <div className="flex items-center space-x-2 flex-shrink-0">
        {isLocalShare && onStopSharing && (
          <button
            onClick={onStopSharing}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm font-medium transition-colors"
          >
            Stop Sharing
          </button>
        )}
        {!isLocalShare && onMinimize && (
          <button
            onClick={onMinimize}
            className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-sm font-medium transition-colors"
          >
            Minimize
          </button>
        )}
      </div>
    </div>
  );
};
