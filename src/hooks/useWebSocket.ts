import { useEffect, useState, useCallback } from 'react';
import { webSocketService } from '../services';
import type { WebSocketMessage, SignalType } from '../types';

export const useWebSocket = (meetingId: string | null) => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!meetingId) return;

    const connect = async () => {
      try {
        await webSocketService.connect(meetingId);
        setIsConnected(true);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Connection failed'));
        setIsConnected(false);
      }
    };

    connect();

    // Check connection status periodically
    const checkInterval = setInterval(() => {
      setIsConnected(webSocketService.isConnected());
    }, 1000);

    return () => {
      clearInterval(checkInterval);
      webSocketService.disconnect();
    };
  }, [meetingId]);

  const send = useCallback((message: WebSocketMessage) => {
    webSocketService.send(message);
  }, []);

  const on = useCallback((type: SignalType, handler: (message: WebSocketMessage) => void) => {
    webSocketService.on(type, handler);
  }, []);

  const off = useCallback((type: SignalType, handler: (message: WebSocketMessage) => void) => {
    webSocketService.off(type, handler);
  }, []);

  return { isConnected, error, send, on, off };
};
