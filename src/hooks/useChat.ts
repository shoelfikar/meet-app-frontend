import { useCallback, useEffect } from 'react';
import { useChatStore } from '../store';
import { apiService } from '../services';
import { useSSE } from './useSSE';

export const useChat = (meetingId: string | null) => {
  const { messages, isChatOpen, unreadCount, addMessage, setMessages, toggleChat, openChat, closeChat } =
    useChatStore();

  // Listen to SSE for new messages
  useSSE(meetingId, {
    onMessage: (event) => {
      if (event.type === 'chat_message') {
        addMessage(event.data);
      }
    },
  });

  // Load chat history when joining meeting
  useEffect(() => {
    if (meetingId) {
      loadChatHistory(meetingId);
    }
  }, [meetingId]);

  const loadChatHistory = async (meetingId: string) => {
    try {
      const history = await apiService.getChatHistory(meetingId);
      setMessages(history);
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  const sendMessage = useCallback(
    async (message: string) => {
      if (!meetingId) return;

      try {
        await apiService.sendChatMessage(meetingId, message);
      } catch (error) {
        console.error('Failed to send message:', error);
        throw error;
      }
    },
    [meetingId]
  );

  return {
    messages,
    isChatOpen,
    unreadCount,
    sendMessage,
    toggleChat,
    openChat,
    closeChat,
  };
};
