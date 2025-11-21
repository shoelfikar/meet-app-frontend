import { create } from 'zustand';
import type { ChatMessage } from '../types';

interface ChatState {
  messages: ChatMessage[];
  unreadCount: number;
  isChatOpen: boolean;

  addMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;
  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;
  markAsRead: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  unreadCount: 0,
  isChatOpen: false,

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
      unreadCount: state.isChatOpen ? state.unreadCount : state.unreadCount + 1,
    })),

  setMessages: (messages) =>
    set({ messages }),

  clearMessages: () =>
    set({
      messages: [],
      unreadCount: 0,
    }),

  toggleChat: () =>
    set((state) => ({
      isChatOpen: !state.isChatOpen,
      unreadCount: !state.isChatOpen ? 0 : state.unreadCount,
    })),

  openChat: () =>
    set({
      isChatOpen: true,
      unreadCount: 0,
    }),

  closeChat: () =>
    set({ isChatOpen: false }),

  markAsRead: () =>
    set({ unreadCount: 0 }),
}));
