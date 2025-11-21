import type { SSEEvent, SSEEventType } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export type SSEEventHandler = (event: SSEEvent) => void;

export class SSEService {
  private eventSource: EventSource | null = null;
  private meetingId: string | null = null;
  private eventHandlers: Map<SSEEventType, Set<SSEEventHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;

  connect(meetingId: string): void {
    if (this.eventSource) {
      this.disconnect();
    }

    this.meetingId = meetingId;
    const token = localStorage.getItem('token');
    const url = `${API_URL}/api/meetings/${meetingId}/events?token=${token}`;

    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      console.log('SSE connected');
      this.reconnectAttempts = 0;
    };

    this.eventSource.onerror = (error) => {
      console.error('SSE error:', error);

      if (this.eventSource?.readyState === EventSource.CLOSED) {
        this.handleReconnect();
      }
    };

    // Listen to all event types
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
      this.eventSource?.addEventListener(type, (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          // Backend sends { type, data }, extract the data part
          const event: SSEEvent = { type, data: parsed.data };
          this.notifyHandlers(type, event);
        } catch (error) {
          console.error('Failed to parse SSE event:', error);
        }
      });
    });
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.meetingId = null;
      this.reconnectAttempts = 0;
    }
  }

  on(eventType: SSEEventType, handler: SSEEventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)?.add(handler);
  }

  off(eventType: SSEEventType, handler: SSEEventHandler): void {
    this.eventHandlers.get(eventType)?.delete(handler);
  }

  private notifyHandlers(eventType: SSEEventType, event: SSEEvent): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.forEach((handler) => handler(event));
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.meetingId) {
      this.reconnectAttempts++;
      console.log(`Reconnecting SSE (attempt ${this.reconnectAttempts})...`);

      setTimeout(() => {
        if (this.meetingId) {
          this.connect(this.meetingId);
        }
      }, this.reconnectDelay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }
}

export const sseService = new SSEService();
export default sseService;
