import { useCallback, useEffect } from 'react';
import { useMeetingStore, useParticipantStore } from '../store';
import { apiService } from '../services';
import { useSSE } from './useSSE';
import type { MeetingParticipant } from '../types';
import type { AxiosError } from 'axios';

export const useMeeting = () => {
  const {
    currentMeeting,
    isRecording,
    isScreenSharing,
    setCurrentMeeting,
    setRecording,
    setScreenSharing,
    leaveMeeting: clearMeeting,
  } = useMeetingStore();

  const {
    // participants,
    addParticipant,
    removeParticipant,
    updateParticipant,
    clearParticipants,
    getParticipantList,
  } = useParticipantStore();

  // Listen to SSE for meeting events (using meeting ID from state)
  useSSE(currentMeeting?.id || null, {
    onMessage: (event) => {
      switch (event.type) {
        case 'participant_joined':
          addParticipant(event.data as MeetingParticipant);
          break;

        case 'participant_left':
          removeParticipant(event.data.user_id);
          break;

        case 'participant_updated':
          updateParticipant(event.data.user.id, event.data);
          break;

        case 'recording_started':
          setRecording(true);
          break;

        case 'recording_stopped':
          setRecording(false);
          break;

        case 'screen_share_started':
          setScreenSharing(true, event.data.user_id);
          break;

        case 'screen_share_stopped':
          setScreenSharing(false);
          break;

        case 'meeting_ended':
          handleMeetingEnded();
          break;
      }
    },
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearMeeting();
      clearParticipants();
    };
  }, []);

  const loadMeetingData = useCallback(async (code: string) => {
    try {
      // First get meeting by code
      const meeting = await apiService.getMeetingByCode(code);
      setCurrentMeeting(meeting);

      // Then get participants using the meeting ID
      const participantList = await apiService.getParticipants(meeting.id);

      // Clear existing participants before adding new ones
      clearParticipants();

      // Add all participants to store
      participantList.forEach((participant: MeetingParticipant) => {
        addParticipant(participant);
      });
    } catch (error) {
      console.error('Failed to load meeting data:', error);
      throw error;
    }
  }, [setCurrentMeeting, clearParticipants, addParticipant]);

  const joinMeeting = useCallback(
    async (code: string) => {
      try {
        // Try to join meeting using code
        await apiService.joinMeeting(code);
      } catch (error) {
        // Check if error is "already in meeting" - this is OK for hosts
        const axiosError = error as AxiosError<{ error?: string }>;
        const errorMessage = axiosError.response?.data?.error || '';

        // If already in meeting, that's fine - just continue to load data
        if (!errorMessage.toLowerCase().includes('already in meeting') &&
            axiosError.response?.status !== 409) {
          console.error('Failed to join meeting:', error);
          throw error;
        }
      }

      // Load meeting data after joining (or if already in meeting)
      await loadMeetingData(code);
    },
    [loadMeetingData]
  );

  const leaveMeeting = useCallback(async () => {
    if (!currentMeeting) return;

    try {
      await apiService.leaveMeeting(currentMeeting.id);
      clearMeeting();
      clearParticipants();
    } catch (error) {
      console.error('Failed to leave meeting:', error);
      throw error;
    }
  }, [currentMeeting]);

  const startRecording = useCallback(async () => {
    if (!currentMeeting) return;

    try {
      await apiService.startRecording(currentMeeting.id);
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }, [currentMeeting]);

  const stopRecording = useCallback(async () => {
    if (!currentMeeting) return;

    try {
      await apiService.stopRecording(currentMeeting.id);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      throw error;
    }
  }, [currentMeeting]);

  const handleMeetingEnded = () => {
    clearMeeting();
    clearParticipants();
    // Redirect to home page
    window.location.href = '/';
  };

  return {
    currentMeeting,
    participants: getParticipantList(),
    isRecording,
    isScreenSharing,
    joinMeeting,
    leaveMeeting,
    startRecording,
    stopRecording,
  };
};
