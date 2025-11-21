import { create } from 'zustand';
import type { MeetingParticipant } from '../types';

interface ParticipantState {
  participants: Map<string, MeetingParticipant>;
  localParticipant: MeetingParticipant | null;

  addParticipant: (participant: MeetingParticipant) => void;
  removeParticipant: (userId: string) => void;
  updateParticipant: (userId: string, updates: Partial<MeetingParticipant>) => void;
  setLocalParticipant: (participant: MeetingParticipant) => void;
  setParticipantStream: (userId: string, stream: MediaStream) => void;
  clearParticipants: () => void;
  getParticipant: (userId: string) => MeetingParticipant | undefined;
  getParticipantList: () => MeetingParticipant[];
}

export const useParticipantStore = create<ParticipantState>((set, get) => ({
  participants: new Map(),
  localParticipant: null,

  addParticipant: (participant) =>
    set((state) => {
      const newParticipants = new Map(state.participants);
      newParticipants.set(participant.user.id, participant);
      return { participants: newParticipants };
    }),

  removeParticipant: (userId) =>
    set((state) => {
      const newParticipants = new Map(state.participants);
      newParticipants.delete(userId);
      return { participants: newParticipants };
    }),

  updateParticipant: (userId, updates) =>
    set((state) => {
      const participant = state.participants.get(userId);
      if (!participant) return state;

      const newParticipants = new Map(state.participants);
      newParticipants.set(userId, { ...participant, ...updates });
      return { participants: newParticipants };
    }),

  setLocalParticipant: (participant) =>
    set({ localParticipant: participant }),

  setParticipantStream: (userId, stream) =>
    set((state) => {
      const participant = state.participants.get(userId);
      if (!participant) return state;

      const newParticipants = new Map(state.participants);
      newParticipants.set(userId, { ...participant, stream });
      return { participants: newParticipants };
    }),

  clearParticipants: () =>
    set({
      participants: new Map(),
      localParticipant: null,
    }),

  getParticipant: (userId) => get().participants.get(userId),

  getParticipantList: () => Array.from(get().participants.values()),
}));
