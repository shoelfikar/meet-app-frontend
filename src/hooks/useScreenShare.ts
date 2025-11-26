import { useRef, useCallback, useState } from 'react';

interface UseScreenShareReturn {
  screenStream: MediaStream | null;
  isScreenSharing: boolean;
  startScreenShare: () => Promise<boolean>;
  stopScreenShare: () => void;
  error: string | null;
}

export const useScreenShare = (): UseScreenShareReturn => {
  const screenStreamRef = useRef<MediaStream | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start screen sharing
  const startScreenShare = useCallback(async (): Promise<boolean> => {
    try {
      // Request screen capture with constraints
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { max: 1920 },
          height: { max: 1080 },
          frameRate: { max: 30 },
        } as MediaTrackConstraints,
        audio: false, // Screen audio disabled for now
      });

      screenStreamRef.current = stream;
      setIsScreenSharing(true);
      setError(null);

      // Listen for "ended" event when user stops sharing via browser UI
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopScreenShare();
        };
      }

      return true;
    } catch (err) {
      console.error('[ScreenShare] Failed to start screen sharing:', err);

      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Screen sharing permission denied');
        } else if (err.name === 'NotFoundError') {
          setError('No screen available to share');
        } else if (err.name === 'AbortError') {
          setError('Screen sharing cancelled');
        } else if (err.name === 'NotSupportedError') {
          setError('Screen sharing is not supported in this browser');
        } else {
          setError(`Failed to start screen sharing: ${err.message}`);
        }
      }

      return false;
    }
  }, []);

  // Stop screen sharing
  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      // Stop all tracks to release screen capture
      screenStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });

      screenStreamRef.current = null;
      setIsScreenSharing(false);
    }
  }, []);

  return {
    screenStream: screenStreamRef.current,
    isScreenSharing,
    startScreenShare,
    stopScreenShare,
    error,
  };
};
