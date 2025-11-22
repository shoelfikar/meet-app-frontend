import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  MicrophoneIcon,
  VideoCameraIcon,
  PhoneIcon,
  ChatBubbleLeftIcon,
  ComputerDesktopIcon,
  UserIcon,
} from '@heroicons/react/24/solid';
import {
  MicrophoneIcon as MicOffIcon,
  VideoCameraSlashIcon,
  XMarkIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import type { Meeting as MeetingType, MeetingParticipant, ChatMessage, SSEEvent } from '../types';
import { apiService } from '../services';
import { webSocketService } from '../services/websocket';
import { webRTCService } from '../services/webrtc';
import { Modal } from '../components/Common/Modal';
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
        const chatMessage = event.data as ChatMessage;
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
    if (peerConnectionsRef.current.has(peerId)) {
      return peerConnectionsRef.current.get(peerId)!;
    }

    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    // Add local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        webSocketService.send({
          type: 'ice-candidate',
          to: peerId,
          data: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid || '',
            sdpMLineIndex: event.candidate.sdpMLineIndex || 0,
          },
        });
      }
    };

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      console.log('Received remote track from', peerId);
      const remoteVideo = remoteVideoRefs.current.get(peerId);
      if (remoteVideo && event.streams[0]) {
        remoteVideo.srcObject = event.streams[0];
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
      console.log(`Peer ${peerId} connection state:`, peerConnection.connectionState);
      if (peerConnection.connectionState === 'failed') {
        peerConnection.close();
        peerConnectionsRef.current.delete(peerId);
      }
    };

    peerConnectionsRef.current.set(peerId, peerConnection);
    return peerConnection;
  }, []);

  // WebRTC: Handle WebSocket messages
  const handleWebSocketMessage = useCallback(async (message: WebSocketMessage) => {
    console.log('WebSocket message:', message);

    switch (message.type) {
      case 'peer-joined': {
        // New peer joined, create offer
        const peerId = message.from!;
        console.log('Peer joined, creating offer for:', peerId);

        const peerConnection = await createPeerConnection(peerId);
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        webSocketService.send({
          type: 'offer',
          to: peerId,
          data: {
            sdp: offer.sdp!,
            type: 'offer',
          },
        });
        break;
      }

      case 'offer': {
        // Received offer, create answer
        const peerId = message.from!;
        console.log('Received offer from:', peerId);

        const peerConnection = await createPeerConnection(peerId);
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription({
            sdp: message.data.sdp,
            type: 'offer',
          })
        );

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        webSocketService.send({
          type: 'answer',
          to: peerId,
          data: {
            sdp: answer.sdp!,
            type: 'answer',
          },
        });
        break;
      }

      case 'answer': {
        // Received answer
        const peerId = message.from!;
        console.log('Received answer from:', peerId);

        const peerConnection = peerConnectionsRef.current.get(peerId);
        if (peerConnection) {
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription({
              sdp: message.data.sdp,
              type: 'answer',
            })
          );
        }
        break;
      }

      case 'ice-candidate': {
        // Received ICE candidate
        const peerId = message.from!;
        console.log('Received ICE candidate from:', peerId);

        const peerConnection = peerConnectionsRef.current.get(peerId);
        if (peerConnection) {
          await peerConnection.addIceCandidate(
            new RTCIceCandidate({
              candidate: message.data.candidate,
              sdpMid: message.data.sdpMid,
              sdpMLineIndex: message.data.sdpMLineIndex,
            })
          );
        }
        break;
      }

      case 'peer-left': {
        // Peer left, cleanup connection
        const peerId = message.from!;
        console.log('Peer left:', peerId);

        const peerConnection = peerConnectionsRef.current.get(peerId);
        if (peerConnection) {
          peerConnection.close();
          peerConnectionsRef.current.delete(peerId);
        }
        remoteVideoRefs.current.delete(peerId);
        break;
      }
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

  const handleSendMessage = () => {
    if (inputMessage.trim()) {
      const newMessage: ChatMessage = {
        id: String(messages.length + 1),
        meeting_id: meeting?.id || '',
        sender_id: 'current-user',
        sender_name: 'You',
        message: inputMessage,
        created_at: new Date().toISOString(),
      };
      setMessages([...messages, newMessage]);
      setInputMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const getGridClass = (count: number) => {
    if (count === 0) return 'grid-cols-1';
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-2';
    if (count <= 4) return 'grid-cols-2';
    if (count <= 6) return 'grid-cols-3';
    return 'grid-cols-4';
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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <XMarkIcon className="w-10 h-10 text-white" />
          </div>
          <p className="text-white text-lg mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // No meeting found
  if (!meeting) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-lg mb-4">Meeting not found</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
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
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold text-lg">{meeting.title}</h2>
            <p className="text-gray-400 text-sm">Code: {meeting.code}</p>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-gray-400 text-sm">
              {totalParticipants} participant{totalParticipants !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center text-green-500 text-sm">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
              {meeting.status === 'active' ? 'Live' : meeting.status}
            </span>
          </div>
        </div>
      </div>

      {/* Media error banner */}
      {mediaError && (
        <div className="bg-yellow-600 text-white px-4 py-2 text-sm">
          {mediaError}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video grid */}
        <div className="flex-1 p-4">
          <div className={`grid gap-4 h-full ${getGridClass(totalParticipants)} auto-rows-fr`}>
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
                  <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center mb-2">
                    <UserIcon className="w-12 h-12 text-gray-500" />
                  </div>
                  <span className="text-white text-sm">You</span>
                </div>
              )}

              {/* Audio level indicator */}
              {isAudioEnabled && audioLevel > 0.05 && (
                <div className="absolute top-3 right-3 flex items-end space-x-0.5 h-4">
                  <div
                    className="w-1 bg-green-500 rounded-sm transition-all duration-75"
                    style={{ height: `${Math.min(audioLevel * 100, 25)}%` }}
                  />
                  <div
                    className="w-1 bg-green-500 rounded-sm transition-all duration-75"
                    style={{ height: `${Math.min(audioLevel * 100, 50)}%` }}
                  />
                  <div
                    className="w-1 bg-green-500 rounded-sm transition-all duration-75"
                    style={{ height: `${Math.min(audioLevel * 100, 75)}%` }}
                  />
                  <div
                    className="w-1 bg-green-500 rounded-sm transition-all duration-75"
                    style={{ height: `${Math.min(audioLevel * 100, 100)}%` }}
                  />
                </div>
              )}

              {/* Local user info overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                <div className="flex items-center justify-between">
                  <span className="text-white text-sm font-medium truncate">
                    You
                    {isCurrentUserHost && (
                      <span className="ml-2 text-xs bg-blue-600 px-2 py-0.5 rounded">Host</span>
                    )}
                  </span>
                  <div className="flex items-center space-x-2">
                    {!isAudioEnabled && (
                      <MicOffIcon className="w-4 h-4 text-red-500" />
                    )}
                    {!isVideoEnabled && (
                      <VideoCameraSlashIcon className="w-4 h-4 text-red-500" />
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
                    <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center mb-2">
                      <UserIcon className="w-12 h-12 text-gray-500" />
                    </div>
                    <span className="text-white text-sm">{participant.user.name}</span>
                  </div>
                )}

                {/* Participant info overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm font-medium truncate">
                      {participant.user.name}
                      {participant.role === 'host' && (
                        <span className="ml-2 text-xs bg-blue-600 px-2 py-0.5 rounded">Host</span>
                      )}
                    </span>
                    <div className="flex items-center space-x-2">
                      {participant.is_muted && (
                        <MicOffIcon className="w-4 h-4 text-red-500" />
                      )}
                      {!participant.is_video_on && (
                        <VideoCameraSlashIcon className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat panel */}
        {isChatOpen && (
          <div className="flex flex-col h-full bg-gray-800 border-l border-gray-700 w-80">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-white font-semibold">Chat</h3>
              <button
                onClick={() => setIsChatOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-400 text-sm">No messages yet</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className="space-y-1">
                    <div className="flex items-baseline space-x-2">
                      <span className="text-blue-400 text-sm font-medium">
                        {message.sender_name}
                      </span>
                      <span className="text-gray-500 text-xs">
                        {formatTime(message.created_at)}
                      </span>
                    </div>
                    <p className="text-white text-sm break-words">{message.message}</p>
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-700">
              <div className="flex items-end space-x-2">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim()}
                  className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  <PaperAirplaneIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center space-x-4 p-4 bg-gray-800 border-t border-gray-700">
        {/* Audio toggle */}
        <button
          onClick={toggleAudio}
          className={`relative p-4 rounded-full transition-colors cursor-pointer ${
            isAudioEnabled
              ? 'bg-gray-700 hover:bg-gray-600'
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
          title={isAudioEnabled ? 'Mute' : 'Unmute'}
        >
          {isAudioEnabled ? (
            <div className="relative w-6 h-6">
              {/* Base icon (gray) */}
              <MicrophoneIcon className="w-6 h-6 text-gray-400" />
              {/* Filled icon (green) - clips from bottom based on audio level */}
              <div
                className="absolute inset-0 overflow-hidden transition-all duration-75"
                style={{
                  clipPath: `inset(${100 - audioLevel * 100}% 0 0 0)`,
                }}
              >
                <MicrophoneIcon className="w-6 h-6 text-green-500" />
              </div>
            </div>
          ) : (
            <MicOffIcon className="w-6 h-6" />
          )}
        </button>

        {/* Video toggle */}
        <button
          onClick={toggleVideo}
          className={`p-4 rounded-full transition-colors cursor-pointer ${
            isVideoEnabled
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
          title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {isVideoEnabled ? (
            <VideoCameraIcon className="w-6 h-6" />
          ) : (
            <VideoCameraSlashIcon className="w-6 h-6" />
          )}
        </button>

        {/* Screen share toggle */}
        <button
          onClick={() => setIsScreenSharing(!isScreenSharing)}
          className={`p-4 rounded-full transition-colors cursor-pointer ${
            isScreenSharing
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
        >
          <ComputerDesktopIcon className="w-6 h-6" />
        </button>

        {/* Chat toggle */}
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="relative p-4 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors cursor-pointer"
          title="Toggle chat"
        >
          <ChatBubbleLeftIcon className="w-6 h-6" />
          {!isChatOpen && messages.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {messages.length}
            </span>
          )}
        </button>

        {/* Leave button */}
        <button
          onClick={handleLeaveClick}
          className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer ml-4"
          title="Leave meeting"
        >
          <PhoneIcon className="w-6 h-6 transform rotate-135" />
        </button>
      </div>

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
