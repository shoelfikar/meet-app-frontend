import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  UserIcon,
} from '@heroicons/react/24/solid';
import {
  MicrophoneIcon as MicOffIcon,
  VideoCameraSlashIcon,
} from '@heroicons/react/24/outline';
import type { Meeting as MeetingType, MeetingParticipant, ChatMessage, SSEEvent } from '../types';
import type { MessageResponse } from '../types/message';
import { transformMessageResponse } from '../types/message';
import { apiService } from '../services';
import { webSocketService } from '../services/websocket';
// import { webRTCService } from '../services/webrtc';
import { Modal } from '../components/Common/Modal';
import { Header } from '../components/Common/Header';
import { ChatPanel } from '../components/Chat/ChatPanel';
import { ErrorMessage } from '../components/Error/ErrorMessage';
import { MediaControls } from '../components/Controls/MediaControls';
import { useSSE } from '../hooks/useSSE';
import type { AxiosError } from 'axios';
import type { WebSocketMessage } from '../types/webrtc';

export const Meeting = () => {
  const { meetingCode } = useParams<{ meetingCode: string }>();
  const navigate = useNavigate();

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  // Meeting state
  const [meeting, setMeeting] = useState<MeetingType | null>(null);
  const [participants, setParticipants] = useState<MeetingParticipant[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Media state
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  // UI state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  // SSE event handler for real-time updates
  const handleSSEMessage = useCallback((event: SSEEvent) => {
    console.log('SSE Event received:', event);

    switch (event.type) {
      case 'participant_joined': {
        const newParticipant = event.data as MeetingParticipant;
        console.log('Participant joined:', newParticipant);

        setParticipants((prev) => {
          // Check if participant already exists (avoid duplicates)
          const exists = prev.some(
            (p) => p.user.id === newParticipant.user.id
          );
          if (exists) {
            console.log('Participant already exists, skipping');
            return prev;
          }
          return [...prev, newParticipant];
        });
        break;
      }

      case 'participant_left': {
        const { user_id } = event.data as { user_id: string };
        console.log('Participant left:', user_id);

        setParticipants((prev) =>
          prev.filter((p) => p.user.id !== user_id)
        );
        break;
      }

      case 'participant_updated': {
        const updatedParticipant = event.data as MeetingParticipant;
        console.log('Participant updated:', updatedParticipant);

        setParticipants((prev) =>
          prev.map((p) =>
            p.user.id === updatedParticipant.user.id ? updatedParticipant : p
          )
        );
        break;
      }

      case 'meeting_ended':
        console.log('Meeting ended');
        navigate('/');
        break;

      case 'chat_message': {
        // Backend sends MessageResponse, transform to ChatMessage
        const messageResponse = event.data as MessageResponse;
        const chatMessage = transformMessageResponse(messageResponse);
        console.log('[Chat] Received message via SSE:', chatMessage);
        setMessages((prev) => [...prev, chatMessage]);
        break;
      }
    }
  }, [navigate]);

  // Connect to SSE for real-time updates
  useSSE(meeting?.id || null, {
    onMessage: handleSSEMessage,
    onOpen: () => console.log('SSE connected'),
    onError: (error) => console.error('SSE error:', error),
  });

  // WebRTC: Create peer connection
  const createPeerConnection = useCallback(async (peerId: string) => {
    // Check if peer connection already exists
    if (peerConnectionsRef.current.has(peerId)) {
      console.log('[WebRTC] Peer connection already exists for:', peerId);
      return peerConnectionsRef.current.get(peerId)!;
    }

    console.log('[WebRTC] Creating new peer connection for:', peerId);
    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    // Add local stream tracks
    if (localStreamRef.current) {
      const tracks = localStreamRef.current.getTracks();
      console.log('[WebRTC] Adding local tracks to peer connection:', tracks.length, 'tracks');
      tracks.forEach((track) => {
        console.log('[WebRTC] Adding track:', track.kind, track.id);
        peerConnection.addTrack(track, localStreamRef.current!);
      });
    } else {
      console.warn('[WebRTC] No local stream available to add tracks');
    }

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] Sending ICE candidate to:', peerId, event.candidate.candidate);
        webSocketService.send({
          type: 'ice-candidate',
          to: peerId,
          data: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid || '',
            sdpMLineIndex: event.candidate.sdpMLineIndex || 0,
          },
        });
      } else {
        console.log('[WebRTC] All ICE candidates sent for:', peerId);
      }
    };

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      console.log('[WebRTC] 🎥 Received remote track from:', peerId, 'Track:', event.track.kind, 'Streams:', event.streams.length);
      const remoteVideo = remoteVideoRefs.current.get(peerId);
      if (remoteVideo && event.streams[0]) {
        console.log('[WebRTC] Setting remote stream to video element for:', peerId);
        remoteVideo.srcObject = event.streams[0];
      } else {
        console.warn('[WebRTC] Remote video element not found or no streams for:', peerId);
      }

      // Update participant with stream
      setParticipants((prev) =>
        prev.map((p) =>
          p.user.id === peerId ? { ...p, stream: event.streams[0] } : p
        )
      );
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`[WebRTC] Peer ${peerId} connection state:`, peerConnection.connectionState);
      if (peerConnection.connectionState === 'failed') {
        console.error('[WebRTC] Connection failed for:', peerId);
        peerConnection.close();
        peerConnectionsRef.current.delete(peerId);
      } else if (peerConnection.connectionState === 'connected') {
        console.log('[WebRTC] ✅ Connection established with:', peerId);
      }
    };

    // Handle ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] Peer ${peerId} ICE connection state:`, peerConnection.iceConnectionState);
    };

    peerConnectionsRef.current.set(peerId, peerConnection);
    console.log('[WebRTC] Peer connection created and stored for:', peerId);
    return peerConnection;
  }, []);

  // WebRTC: Handle WebSocket messages
  const handleWebSocketMessage = useCallback(async (message: WebSocketMessage) => {
    console.log('[WebRTC] Received WebSocket message:', message.type, message);

    switch (message.type) {
      case 'ready': {
        // Received list of existing peers when we join
        const peers = message.data as Array<{ user_id: string; username: string }>;
        console.log('[WebRTC] Ready - existing peers in meeting:', peers.length, peers);
        // Don't create offers, existing peers will send offers to us
        break;
      }

      case 'peer-joined': {
        // New peer joined, we (existing peer) should create offer
        const peerData = message.data as { user_id: string; username: string };
        const peerId = peerData.user_id;
        console.log('[WebRTC] New peer joined:', peerData.username, '(', peerId, ') - Creating offer');

        try {
          const peerConnection = await createPeerConnection(peerId);
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);

          console.log('[WebRTC] Sending offer to:', peerId);
          webSocketService.send({
            type: 'offer',
            to: peerId,
            data: {
              sdp: offer.sdp!,
              type: 'offer',
            },
          });
        } catch (error) {
          console.error('[WebRTC] Error creating offer for:', peerId, error);
        }
        break;
      }

      case 'offer': {
        // Received offer from existing peer, create answer
        const peerId = message.from!;
        console.log('[WebRTC] Received offer from:', peerId);

        try {
          const peerConnection = await createPeerConnection(peerId);

          console.log('[WebRTC] Setting remote description (offer)');
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription({
              sdp: message.data.sdp,
              type: 'offer',
            })
          );

          console.log('[WebRTC] Creating answer');
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);

          console.log('[WebRTC] Sending answer to:', peerId);
          webSocketService.send({
            type: 'answer',
            to: peerId,
            data: {
              sdp: answer.sdp!,
              type: 'answer',
            },
          });
        } catch (error) {
          console.error('[WebRTC] Error handling offer from:', peerId, error);
        }
        break;
      }

      case 'answer': {
        // Received answer to our offer
        const peerId = message.from!;
        console.log('[WebRTC] Received answer from:', peerId);

        try {
          const peerConnection = peerConnectionsRef.current.get(peerId);
          if (peerConnection) {
            console.log('[WebRTC] Setting remote description (answer)');
            await peerConnection.setRemoteDescription(
              new RTCSessionDescription({
                sdp: message.data.sdp,
                type: 'answer',
              })
            );
            console.log('[WebRTC] Remote description set, connection should be established');
          } else {
            console.error('[WebRTC] No peer connection found for:', peerId);
          }
        } catch (error) {
          console.error('[WebRTC] Error handling answer from:', peerId, error);
        }
        break;
      }

      case 'ice-candidate': {
        // Received ICE candidate
        const peerId = message.from!;
        console.log('[WebRTC] Received ICE candidate from:', peerId, message.data);

        try {
          const peerConnection = peerConnectionsRef.current.get(peerId);
          if (peerConnection) {
            await peerConnection.addIceCandidate(
              new RTCIceCandidate({
                candidate: message.data.candidate,
                sdpMid: message.data.sdpMid,
                sdpMLineIndex: message.data.sdpMLineIndex,
              })
            );
            console.log('[WebRTC] ICE candidate added successfully');
          } else {
            console.error('[WebRTC] No peer connection found for ICE candidate from:', peerId);
          }
        } catch (error) {
          console.error('[WebRTC] Error adding ICE candidate from:', peerId, error);
        }
        break;
      }

      case 'peer-left': {
        // Peer left, cleanup connection
        const peerData = message.data as { user_id: string; username: string };
        const peerId = peerData.user_id;
        console.log('[WebRTC] Peer left:', peerData.username, '(', peerId, ')');

        const peerConnection = peerConnectionsRef.current.get(peerId);
        if (peerConnection) {
          peerConnection.close();
          peerConnectionsRef.current.delete(peerId);
        }
        remoteVideoRefs.current.delete(peerId);
        break;
      }

      default:
        console.warn('[WebRTC] Unknown message type:', message.type);
    }
  }, [createPeerConnection]);

  // WebSocket: Connect and setup listeners
  useEffect(() => {
    if (!meeting?.id) return;

    const connectWebSocket = async () => {
      try {
        await webSocketService.connect(meeting.id);
        console.log('WebSocket connected for meeting:', meeting.id);

        // Setup message handlers
        webSocketService.on('ready', handleWebSocketMessage);
        webSocketService.on('peer-joined', handleWebSocketMessage);
        webSocketService.on('offer', handleWebSocketMessage);
        webSocketService.on('answer', handleWebSocketMessage);
        webSocketService.on('ice-candidate', handleWebSocketMessage);
        webSocketService.on('peer-left', handleWebSocketMessage);
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
      }
    };

    connectWebSocket();

    return () => {
      // Cleanup WebSocket listeners
      webSocketService.off('ready', handleWebSocketMessage);
      webSocketService.off('peer-joined', handleWebSocketMessage);
      webSocketService.off('offer', handleWebSocketMessage);
      webSocketService.off('answer', handleWebSocketMessage);
      webSocketService.off('ice-candidate', handleWebSocketMessage);
      webSocketService.off('peer-left', handleWebSocketMessage);

      // Close all peer connections
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();

      // Disconnect WebSocket
      webSocketService.disconnect();
    };
  }, [meeting?.id, handleWebSocketMessage]);

  // Initialize media devices
  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
      });

      localStreamRef.current = stream;

      // Attach stream to video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Setup audio level detection
      setupAudioAnalyser(stream);

      setMediaError(null);
      return true;
    } catch (err) {
      console.error('Failed to get media devices:', err);

      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setMediaError('Camera and microphone access denied. Please allow access in your browser settings.');
        } else if (err.name === 'NotFoundError') {
          setMediaError('No camera or microphone found. Please connect a device.');
        } else {
          setMediaError(`Failed to access media devices: ${err.message}`);
        }
      }
      return false;
    }
  };

  // Setup audio analyser for level detection
  const setupAudioAnalyser = (stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Start monitoring audio levels
      monitorAudioLevel();
    } catch (err) {
      console.error('Failed to setup audio analyser:', err);
    }
  };

  // Monitor audio level
  const monitorAudioLevel = () => {
    if (!analyserRef.current || !isAudioEnabled) {
      setAudioLevel(0);
      return;
    }

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average volume
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    const normalizedLevel = Math.min(average / 128, 1); // Normalize to 0-1

    setAudioLevel(normalizedLevel);

    // Continue monitoring
    animationFrameRef.current = requestAnimationFrame(monitorAudioLevel);
  };

  // Effect to handle audio monitoring based on audio enabled state
  useEffect(() => {
    if (isAudioEnabled && analyserRef.current) {
      monitorAudioLevel();
    } else {
      setAudioLevel(0);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isAudioEnabled]);

  // Toggle audio
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !isAudioEnabled;
      });
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  // Toggle video
  const toggleVideo = async () => {
    if (!localStreamRef.current) return;

    if (isVideoEnabled) {
      // Turn off video - stop the track to release camera
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach((track) => {
        track.stop();
        localStreamRef.current?.removeTrack(track);
      });

      // Clear video element to fully release camera
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
        // Re-attach stream without video for audio to continue
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      setIsVideoEnabled(false);
    } else {
      // Turn on video - get new video stream
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
        });

        const newVideoTrack = videoStream.getVideoTracks()[0];
        localStreamRef.current.addTrack(newVideoTrack);

        // Update video element
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null;
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        setIsVideoEnabled(true);
      } catch (err) {
        console.error('Failed to enable video:', err);
        setMediaError('Failed to access camera. Please check permissions.');
      }
    }
  };

  // Stop all media tracks
  const stopMediaTracks = () => {
    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
      analyserRef.current = null;
    }

    // Clear video element source
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    // Stop all media tracks to release camera/mic permissions
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      localStreamRef.current = null;
    }
  };

  // Fetch meeting and participants on mount
  useEffect(() => {
    const initMeeting = async () => {
      if (!meetingCode) {
        navigate('/');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Initialize media first
        await initializeMedia();

        // Get meeting by code
        const meetingData = await apiService.getMeetingByCode(meetingCode);
        setMeeting(meetingData);

        // Try to join the meeting
        try {
          await apiService.joinMeeting(meetingCode);
        } catch (joinError) {
          // Ignore "already in meeting" error - this is OK for hosts
          const axiosError = joinError as AxiosError<{ error?: string }>;
          const errorMessage = axiosError.response?.data?.error || '';

          if (!errorMessage.toLowerCase().includes('already') &&
              axiosError.response?.status !== 409) {
            throw joinError;
          }
        }

        // Get current user from API to ensure we have correct ID
        const currentUser = await apiService.getMe();
        const currentUserIdStr = String(currentUser.id);
        setCurrentUserId(currentUserIdStr);

        // Get participants
        const participantList = await apiService.getParticipants(meetingData.id);
        setParticipants(participantList);

        // Load chat history
        try {
          const chatHistory = await apiService.getChatHistory(meetingData.id);
          // Transform backend MessageResponse[] to ChatMessage[]
          const transformedMessages = chatHistory.map((msg: MessageResponse) =>
            transformMessageResponse(msg)
          );
          setMessages(transformedMessages);
          console.log('[Chat] Loaded', transformedMessages.length, 'messages from history');
        } catch (chatErr) {
          console.error('[Chat] Failed to load chat history:', chatErr);
          // Don't fail the whole meeting join if chat history fails
        }

      } catch (err) {
        console.error('Failed to initialize meeting:', err);
        const axiosError = err as AxiosError<{ error?: string }>;

        if (axiosError.response?.status === 404) {
          setError('Meeting not found. Please check the meeting code.');
        } else {
          setError('Failed to join meeting. Please try again.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    initMeeting();

    // Handle page unload/close to release camera
    const handleBeforeUnload = () => {
      stopMediaTracks();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      stopMediaTracks();
    };
  }, [meetingCode, navigate]);

  // Update video element when ref is available or video is enabled
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [meeting, isVideoEnabled, isLoading]);

  const handleLeaveClick = () => {
    setShowLeaveModal(true);
  };

  const handleLeaveConfirm = async () => {
    // Stop media tracks
    stopMediaTracks();

    try {
      if (meeting) {
        await apiService.leaveMeeting(meeting.id);
      }
    } catch (err) {
      console.error('Failed to leave meeting:', err);
    }
    navigate('/');
  };

  const handleLeaveCancel = () => {
    setShowLeaveModal(false);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !meeting?.id) return;

    try {
      // Send message to backend - will be broadcast via SSE to all participants
      await apiService.sendChatMessage(meeting.id, inputMessage);

      // Clear input after successful send
      setInputMessage('');

      console.log('[Chat] Message sent successfully');
    } catch (error) {
      console.error('[Chat] Failed to send message:', error);
      // TODO: Show error notification to user
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getGridClass = (count: number) => {
    // Mobile: 1 column for all, 2 for 2+ participants
    // Tablet (sm): 2 columns max
    // Desktop (md): 2-3 columns
    // Large (lg): 2-4 columns
    if (count === 0 || count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-1 sm:grid-cols-2';
    if (count <= 4) return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2';
    if (count <= 6) return 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3';
    return 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Joining meeting...</p>
          <p className="text-gray-400 text-sm mt-2">Setting up camera and microphone...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <ErrorMessage
        type="error"
        title="Failed to Join Meeting"
        message={error}
        buttonText="Back to Home"
        onButtonClick={() => navigate('/')}
      />
    );
  }

  // No meeting found
  if (!meeting) {
    return (
      <ErrorMessage
        type="not-found"
        title="Meeting Not Found"
        message="The meeting you're looking for doesn't exist or has ended."
        buttonText="Back to Home"
        onButtonClick={() => navigate('/')}
      />
    );
  }

  // Filter out current user from participants (to avoid duplicate with local video)
  const remoteParticipants = participants.filter(
    (participant) => {
      // Compare user IDs - ensure both are strings for comparison
      const participantUserId = String(participant.user.id);

      // Filter out current user
      if (currentUserId && participantUserId === currentUserId) {
        return false;
      }

      return true;
    }
  );


  // Check if current user is the host
  const isCurrentUserHost = currentUserId === String(meeting?.host_id);

  // Calculate total participants (remote + local user)
  const totalParticipants = remoteParticipants.length + 1

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <Header
        title={meeting.title}
        code={meeting.code}
        totalParticipants={totalParticipants}
        status={meeting.status}
      />

      {/* Media error banner */}
      {mediaError && (
        <div className="bg-yellow-600 text-white px-4 py-2 text-sm">
          {mediaError}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Video grid */}
        <div className="flex-1 p-2 sm:p-3 md:p-4">
          <div className={`grid gap-2 sm:gap-3 md:gap-4 h-full ${getGridClass(totalParticipants)} auto-rows-fr`}>
            {/* Local video (You) */}
            <div className="relative bg-gray-800 rounded-xl overflow-hidden flex items-center justify-center">
              {/* Video element - always mounted to prevent re-initialization */}
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${isVideoEnabled ? 'block' : 'hidden'}`}
                style={{ transform: 'scaleX(-1)' }}
              />

              {/* Placeholder when video is off */}
              {!isVideoEnabled && (
                <div className="flex flex-col items-center justify-center absolute inset-0">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-gray-700 rounded-full flex items-center justify-center mb-1 sm:mb-2">
                    <UserIcon className="w-6 h-6 sm:w-10 sm:h-10 md:w-12 md:h-12 text-gray-500" />
                  </div>
                  <span className="text-white text-xs sm:text-sm">You</span>
                </div>
              )}

              {/* Audio level indicator */}
              {isAudioEnabled && audioLevel > 0.05 && (
                <div className="absolute top-2 right-2 sm:top-3 sm:right-3 flex items-end space-x-0.5 h-3 sm:h-4">
                  <div
                    className="w-0.5 sm:w-1 bg-green-500 rounded-sm transition-all duration-75"
                    style={{ height: `${Math.min(audioLevel * 100, 25)}%` }}
                  />
                  <div
                    className="w-0.5 sm:w-1 bg-green-500 rounded-sm transition-all duration-75"
                    style={{ height: `${Math.min(audioLevel * 100, 50)}%` }}
                  />
                  <div
                    className="w-0.5 sm:w-1 bg-green-500 rounded-sm transition-all duration-75"
                    style={{ height: `${Math.min(audioLevel * 100, 75)}%` }}
                  />
                  <div
                    className="w-0.5 sm:w-1 bg-green-500 rounded-sm transition-all duration-75"
                    style={{ height: `${Math.min(audioLevel * 100, 100)}%` }}
                  />
                </div>
              )}

              {/* Local user info overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 sm:p-3">
                <div className="flex items-center justify-between">
                  <span className="text-white text-xs sm:text-sm font-medium truncate">
                    You
                    {isCurrentUserHost && (
                      <span className="ml-1 sm:ml-2 text-xs bg-blue-600 px-1.5 sm:px-2 py-0.5 rounded">Host</span>
                    )}
                  </span>
                  <div className="flex items-center space-x-1 sm:space-x-2">
                    {!isAudioEnabled && (
                      <MicOffIcon className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />
                    )}
                    {!isVideoEnabled && (
                      <VideoCameraSlashIcon className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Remote participants */}
            {remoteParticipants.map((participant) => (
              <div
                key={participant.id}
                className="relative bg-gray-800 rounded-xl overflow-hidden flex items-center justify-center"
              >
                {/* Remote video element */}
                {participant.stream ? (
                  <video
                    ref={(el) => {
                      if (el) {
                        remoteVideoRefs.current.set(participant.user.id, el);
                        if (participant.stream) {
                          el.srcObject = participant.stream;
                        }
                      }
                    }}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-gray-700 rounded-full flex items-center justify-center mb-1 sm:mb-2">
                      <UserIcon className="w-6 h-6 sm:w-10 sm:h-10 md:w-12 md:h-12 text-gray-500" />
                    </div>
                    <span className="text-white text-xs sm:text-sm">{participant.user.name}</span>
                  </div>
                )}

                {/* Participant info overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 sm:p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white text-xs sm:text-sm font-medium truncate">
                      {participant.user.name}
                      {participant.role === 'host' && (
                        <span className="ml-1 sm:ml-2 text-xs bg-blue-600 px-1.5 sm:px-2 py-0.5 rounded">Host</span>
                      )}
                    </span>
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      {participant.is_muted && (
                        <MicOffIcon className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />
                      )}
                      {!participant.is_video_on && (
                        <VideoCameraSlashIcon className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat panel */}
        <ChatPanel
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          messages={messages}
          inputMessage={inputMessage}
          onInputChange={setInputMessage}
          onSendMessage={handleSendMessage}
          onKeyDown={handleKeyDown}
        />
      </div>

      {/* Controls */}
      <MediaControls
        isAudioEnabled={isAudioEnabled}
        audioLevel={audioLevel}
        onToggleAudio={toggleAudio}
        isVideoEnabled={isVideoEnabled}
        onToggleVideo={toggleVideo}
        isScreenSharing={isScreenSharing}
        onToggleScreenShare={() => setIsScreenSharing(!isScreenSharing)}
        isChatOpen={isChatOpen}
        messageCount={messages.length}
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
        onLeave={handleLeaveClick}
      />

      {/* Leave Meeting Modal */}
      <Modal
        isOpen={showLeaveModal}
        onClose={handleLeaveCancel}
        title="Leave Meeting?"
        message="Are you sure you want to leave this meeting?"
        buttons={[
          {
            label: 'Cancel',
            onClick: handleLeaveCancel,
            variant: 'secondary',
          },
          {
            label: 'Leave',
            onClick: handleLeaveConfirm,
            variant: 'danger',
          },
        ]}
      />
    </div>
  );
};
