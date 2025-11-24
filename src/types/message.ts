// Backend message response format
export interface MessageResponse {
  id: string;
  meeting_id: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  type: string;
  content: string;
  file_url?: string;
  created_at: string;
}

// Frontend chat message format (for display)
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

// Helper function to transform backend message to frontend format
export function transformMessageResponse(msg: MessageResponse): ChatMessage {
  return {
    id: msg.id,
    meeting_id: msg.meeting_id,
    sender_id: msg.user.id,
    sender_name: msg.user.name,
    message: msg.content,
    created_at: msg.created_at,
  };
}
