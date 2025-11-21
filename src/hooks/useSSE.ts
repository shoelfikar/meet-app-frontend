import { useEffect, useState } from 'react';
import { sseService } from '../services';
import type { SSEEvent, SSEEventType } from '../types';

interface UseSSEOptions {
  onMessage?: (event: SSEEvent) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
}

export const useSSE = (
  meetingId: string | null,
  options: UseSSEOptions = {}
) => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!meetingId) return;

    sseService.connect(meetingId);
    setIsConnected(sseService.isConnected());

    // Call onOpen callback
    if (sseService.isConnected()) {
      options.onOpen?.();
    }

    // Check connection status periodically
    const checkInterval = setInterval(() => {
      setIsConnected(sseService.isConnected());
    }, 1000);

    return () => {
      clearInterval(checkInterval);
      sseService.disconnect();
    };
  }, [meetingId]);

  useEffect(() => {
    if (!options.onMessage) return;

    const eventTypes: SSEEventType[] = [
      'chat_message',
      'participant_joined',
      'participant_left',
      'participant_updated',
      'recording_started',
      'recording_stopped',
      'meeting_ended',
      'screen_share_started',
      'screen_share_stopped',
    ];

    eventTypes.forEach((type) => {
      sseService.on(type, options.onMessage!);
    });

    return () => {
      eventTypes.forEach((type) => {
        if (options.onMessage) {
          sseService.off(type, options.onMessage);
        }
      });
    };
  }, [options.onMessage]);

  return { isConnected };
};
