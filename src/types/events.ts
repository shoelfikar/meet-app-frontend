import type { ChatMessage } from './message';
import type { MeetingParticipant } from './meeting';

export type SSEEventType =
  | 'chat_message'
  | 'participant_joined'
  | 'participant_left'
  | 'participant_updated'
  | 'recording_started'
  | 'recording_stopped'
  | 'meeting_ended'
  | 'screen_share_started'
  | 'screen_share_stopped';

export interface SSEEvent<T = any> {
  type: SSEEventType;
  data: T;
}

export interface ChatMessageEvent extends SSEEvent<ChatMessage> {
  type: 'chat_message';
}

export interface ParticipantJoinedEvent extends SSEEvent<MeetingParticipant> {
  type: 'participant_joined';
}

export interface ParticipantLeftEvent extends SSEEvent<{ user_id: string }> {
  type: 'participant_left';
}

export interface ParticipantUpdatedEvent extends SSEEvent<MeetingParticipant> {
  type: 'participant_updated';
}

export interface RecordingEvent extends SSEEvent<{ recording_id?: string }> {
  type: 'recording_started' | 'recording_stopped';
}

export interface MeetingEndedEvent extends SSEEvent<{ ended_at: string }> {
  type: 'meeting_ended';
}

export interface ScreenShareEvent extends SSEEvent<{ user_id: string; user_name: string }> {
  type: 'screen_share_started' | 'screen_share_stopped';
}
