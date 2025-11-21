export interface ChatMessage {
  id: string;
  meeting_id: string;
  sender_id: string;
  sender_name: string;
  message: string;
  created_at: string;
}

export interface SendMessageData {
  message: string;
}
