import { useState, useCallback, useEffect } from 'react';
import { webRTCService } from '../services';

export const useMedia = () => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const getMedia = useCallback(async (
    constraints: MediaStreamConstraints = { audio: true, video: true }
  ) => {
    try {
      const stream = await webRTCService.getLocalStream(constraints);
      setLocalStream(stream);
      setIsAudioEnabled(constraints.audio !== false);
      setIsVideoEnabled(constraints.video !== false);
      setError(null);
      return stream;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to get media');
      setError(error);
      throw error;
    }
  }, []);

  const toggleAudio = useCallback(() => {
    const newState = !isAudioEnabled;
    webRTCService.toggleAudio(newState);
    setIsAudioEnabled(newState);
    return newState;
  }, [isAudioEnabled]);

  const toggleVideo = useCallback(() => {
    const newState = !isVideoEnabled;
    webRTCService.toggleVideo(newState);
    setIsVideoEnabled(newState);
    return newState;
  }, [isVideoEnabled]);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await webRTCService.getScreenStream();
      setScreenStream(stream);
      setIsScreenSharing(true);

      // Listen for screen share stop (when user clicks "Stop sharing" in browser)
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        stopScreenShare();
      });

      return stream;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to start screen share');
      setError(error);
      throw error;
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    webRTCService.stopScreenShare();
    setScreenStream(null);
    setIsScreenSharing(false);
  }, []);

  const cleanup = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
    }
  }, [localStream, screenStream]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  return {
    localStream,
    screenStream,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    error,
    getMedia,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    cleanup,
  };
};
