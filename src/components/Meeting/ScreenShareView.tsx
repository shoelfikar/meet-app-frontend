import React, { useRef, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { ComputerDesktopIcon } from '@heroicons/react/24/solid';

interface ScreenShareViewProps {
  stream: MediaStream;
  presenterName: string;
  isLocalShare: boolean;
  onMinimize?: () => void;
}

export const ScreenShareView: React.FC<ScreenShareViewProps> = ({
  stream,
  presenterName,
  isLocalShare,
  onMinimize,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden w-full h-full flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ComputerDesktopIcon className="w-5 h-5 text-blue-400" />
            <span className="text-white text-sm sm:text-base font-medium">
              {isLocalShare ? 'You are presenting' : `${presenterName} is presenting`}
            </span>
          </div>
          {onMinimize && (
            <button
              onClick={onMinimize}
              className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
              title="Minimize"
            >
              <XMarkIcon className="w-5 h-5 text-white" />
            </button>
          )}
        </div>
      </div>

      {/* Video Display */}
      <div className="flex-1 flex items-center justify-center p-2 sm:p-4">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="max-w-full max-h-full object-contain"
          style={{ transform: 'scaleX(1)' }}
        />
      </div>

      {/* Footer Info (Optional) */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 sm:p-3">
        <p className="text-white/80 text-xs sm:text-sm text-center">
          {isLocalShare ? 'Your screen is being shared with others' : 'Viewing shared screen'}
        </p>
      </div>
    </div>
  );
};
