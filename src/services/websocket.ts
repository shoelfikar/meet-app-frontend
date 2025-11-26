import type { WebSocketMessage, SignalType } from '../types';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';

export type WebSocketMessageHandler = (message: WebSocketMessage) => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private meetingId: string | null = null;
  private messageHandlers: Map<SignalType, Set<WebSocketMessageHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000;
  private heartbeatInterval: number | null = null;

  connect(meetingId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws) {
        this.disconnect();
      }

      this.meetingId = meetingId;
      const token = localStorage.getItem('token');
      const url = `${WS_URL}/ws?meeting_id=${meetingId}&token=${token}`;

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        resolve();
      };

      this.ws.onclose = (event) => {
        this.stopHeartbeat();

        if (!event.wasClean) {
          this.handleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      this.ws.onmessage = (event) => {
        try {
          // Backend may send multiple messages separated by newlines
          const messages = event.data.split('\n').filter((msg: string) => msg.trim());

          for (const messageStr of messages) {
            try {
              const message: WebSocketMessage = JSON.parse(messageStr);
              this.notifyHandlers(message.type, message);
            } catch (parseError) {
              console.error('[WebSocket] Failed to parse message:', parseError);
            }
          }
        } catch (error) {
          console.error('[WebSocket] Failed to process message:', error);
        }
      };
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.stopHeartbeat();
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
      this.meetingId = null;
      this.reconnectAttempts = 0;
    }
  }

  send(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  on(messageType: SignalType, handler: WebSocketMessageHandler): void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, new Set());
    }
    this.messageHandlers.get(messageType)?.add(handler);
  }

  off(messageType: SignalType, handler: WebSocketMessageHandler): void {
    this.messageHandlers.get(messageType)?.delete(handler);
  }

  private notifyHandlers(messageType: SignalType, message: WebSocketMessage): void {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      handlers.forEach((handler) => handler(message));
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.meetingId) {
      this.reconnectAttempts++;

      setTimeout(() => {
        if (this.meetingId) {
          this.connect(this.meetingId).catch((error) => {
            console.error('Reconnection failed:', error);
          });
        }
      }, this.reconnectDelay);
    } else {
      console.error('Max WebSocket reconnection attempts reached');
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const webSocketService = new WebSocketService();
export default webSocketService;
