import { create } from 'zustand';
import type { Meeting } from '../types';

interface MeetingState {
  currentMeeting: Meeting | null;
  isRecording: boolean;
  isScreenSharing: boolean;
  screenSharingUserId: string | null;

  setCurrentMeeting: (meeting: Meeting | null) => void;
  updateMeeting: (updates: Partial<Meeting>) => void;
  setRecording: (isRecording: boolean) => void;
  setScreenSharing: (isSharing: boolean, userId?: string) => void;
  leaveMeeting: () => void;
}

export const useMeetingStore = create<MeetingState>((set) => ({
  currentMeeting: null,
  isRecording: false,
  isScreenSharing: false,
  screenSharingUserId: null,

  setCurrentMeeting: (meeting) =>
    set({
      currentMeeting: meeting,
      isRecording: meeting?.is_recording || false,
    }),

  updateMeeting: (updates) =>
    set((state) => ({
      currentMeeting: state.currentMeeting
        ? { ...state.currentMeeting, ...updates }
        : null,
    })),

  setRecording: (isRecording) =>
    set((state) => ({
      isRecording,
      currentMeeting: state.currentMeeting
        ? { ...state.currentMeeting, is_recording: isRecording }
        : null,
    })),

  setScreenSharing: (isSharing, userId) =>
    set({
      isScreenSharing: isSharing,
      screenSharingUserId: isSharing ? userId || null : null,
    }),

  leaveMeeting: () =>
    set({
      currentMeeting: null,
      isRecording: false,
      isScreenSharing: false,
      screenSharingUserId: null,
    }),
}));
