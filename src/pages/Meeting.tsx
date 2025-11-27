import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  MicrophoneIcon as MicOffIcon,
  VideoCameraSlashIcon,
} from '@heroicons/react/24/outline';
import { ComputerDesktopIcon } from '@heroicons/react/24/solid';
import type { Meeting as MeetingType, MeetingParticipant, ChatMessage, SSEEvent } from '../types';
import type { MessageResponse } from '../types/message';
import { transformMessageResponse } from '../types/message';
import { apiService } from '../services';
import { webSocketService } from '../services/websocket';
// import { webRTCService } from '../services/webrtc';
import { Modal } from '../components/Common/Modal';
import { Header } from '../components/Common/Header';
import { Avatar } from '../components/Common/Avatar';
import { ChatPanel } from '../components/Chat/ChatPanel';
import { ErrorMessage } from '../components/Error/ErrorMessage';
import { MediaControls } from '../components/Controls/MediaControls';
import { JoinRequestPopup } from '../components/Meeting/JoinRequestPopup';
import { WaitingForApproval } from '../components/Meeting/WaitingForApproval';
import { ScreenShareView } from '../components/Meeting/ScreenShareView';
import { ScreenShareIndicator } from '../components/Meeting/ScreenShareIndicator';
import { useSSE } from '../hooks/useSSE';
import { useScreenShare } from '../hooks/useScreenShare';
import type { AxiosError } from 'axios';
import type { WebSocketMessage, JoinRequestInfo } from '../types/webrtc';

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
  const screenTrackSendersRef = useRef<Map<string, RTCRtpSender>>(new Map()); // Track screen senders per peer
  const participantsRef = useRef<MeetingParticipant[]>([]); // Keep participants in ref for access in callbacks
  const isJoiningRef = useRef<boolean>(false); // Prevent duplicate join attempts

  // Meeting state
  const [meeting, setMeeting] = useState<MeetingType | null>(null);
  const [participants, setParticipants] = useState<MeetingParticipant[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Media state
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isMediaReady, setIsMediaReady] = useState(false);
  const [currentAudioDeviceId, setCurrentAudioDeviceId] = useState<string>('');
  const [currentVideoDeviceId, setCurrentVideoDeviceId] = useState<string>('');

  // Screen share hook
  const {
    screenStream,
    isScreenSharing,
    startScreenShare,
    stopScreenShare,
    error: screenShareError,
  } = useScreenShare();

  // UI state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  // Screen share state
  const [screenSharingUser, setScreenSharingUser] = useState<{ userId: string; username: string } | null>(null);
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isScreenShareMinimized, setIsScreenShareMinimized] = useState(false);

  // Join approval state
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<JoinRequestInfo[]>([]);
  const [isJoinApproved, setIsJoinApproved] = useState(false);

  // SSE event handler for real-time updates
  const handleSSEMessage = useCallback((event: SSEEvent) => {
    switch (event.type) {
      case 'participant_joined': {
        const newParticipant = event.data as MeetingParticipant;

        setParticipants((prev) => {
          // Check if participant already exists (avoid duplicates)
          const exists = prev.some(
            (p) => p.user.id === newParticipant.user.id
          );
          if (exists) return prev;
          return [...prev, newParticipant];
        });
        break;
      }

      case 'participant_left': {
        const { user_id } = event.data as { user_id: string };

        setParticipants((prev) =>
          prev.filter((p) => p.user.id !== user_id)
        );
        break;
      }

      case 'participant_updated': {
        const updatedParticipant = event.data as MeetingParticipant;

        setParticipants((prev) =>
          prev.map((p) =>
            p.user.id === updatedParticipant.user.id ? updatedParticipant : p
          )
        );
        break;
      }

      case 'meeting_ended':
        navigate('/');
        break;

      case 'chat_message': {
        // Backend sends MessageResponse, transform to ChatMessage
        const messageResponse = event.data as MessageResponse;
        const chatMessage = transformMessageResponse(messageResponse);
        setMessages((prev) => [...prev, chatMessage]);
        break;
      }
    }
  }, [navigate]);

  // Connect to SSE for real-time updates
  useSSE(meeting?.id || null, {
    onMessage: handleSSEMessage,
    onError: (error) => console.error('SSE error:', error),
  });

  // Join meeting and load participants (called after approval)
  const joinMeetingAndLoadData = useCallback(async (meetingData: MeetingType) => {
    // Prevent duplicate join attempts
    if (isJoiningRef.current) {
      console.log('[Join] Already joining meeting, skipping duplicate call');
      return;
    }

    console.log('[Join] Attempting to join meeting:', meetingData.code);
    isJoiningRef.current = true;

    try {
      // Try to join the meeting
      try {
        await apiService.joinMeeting(meetingData.code);
        console.log('[Join] Successfully joined meeting');
      } catch (joinError) {
        // Ignore "already in meeting" error - this is OK for hosts and re-joins
        const axiosError = joinError as AxiosError<{ error?: string }>;
        const errorMessage = axiosError.response?.data?.error || '';

        if (errorMessage.toLowerCase().includes('already') || axiosError.response?.status === 409) {
          console.log('[Join] User already in meeting (expected on refresh/re-join) - continuing...');
          // Continue silently - this is normal behavior
        } else {
          // Only throw if it's a different error
          console.error('[Join] Join meeting failed with unexpected error:', errorMessage);
          throw joinError;
        }
      }

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
      } catch (chatErr) {
        console.error('[Chat] Failed to load chat history:', chatErr);
      }
    } catch (err) {
      console.error('Failed to join meeting:', err);
      setError('Failed to join meeting. Please try again.');
    } finally {
      // Reset joining flag
      isJoiningRef.current = false;
    }
  }, []);

  // WebRTC: Create peer connection
  const createPeerConnection = useCallback(async (peerId: string) => {
    // Check if peer connection already exists
    if (peerConnectionsRef.current.has(peerId)) {
      return peerConnectionsRef.current.get(peerId)!;
    }

    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    // Add local stream tracks
    if (localStreamRef.current) {
      const tracks = localStreamRef.current.getTracks();
      tracks.forEach((track) => {
        peerConnection.addTrack(track, localStreamRef.current!);
      });
    }

    // Add screen share track if currently sharing
    if (screenStream && isScreenSharing) {
      const screenTrack = screenStream.getVideoTracks()[0];
      if (screenTrack) {
        const sender = peerConnection.addTrack(screenTrack, screenStream);
        screenTrackSendersRef.current.set(peerId, sender);
      }
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
      if (event.streams && event.streams.length > 0) {
        const stream = event.streams[0];
        const hasAudio = stream.getAudioTracks().length > 0;
        const hasVideo = stream.getVideoTracks().length > 0;
        const isScreenShare = hasVideo && !hasAudio;

        if (isScreenShare) {
          setRemoteScreenStreams((prev) => {
            const newMap = new Map(prev);
            newMap.set(peerId, stream);
            return newMap;
          });

          // Monitor screen share track for ended event
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            videoTrack.onended = () => {
              console.warn('[WebRTC] Screen share track ended for:', peerId);
              setRemoteScreenStreams((prev) => {
                const newMap = new Map(prev);
                newMap.delete(peerId);
                return newMap;
              });
            };

            videoTrack.onmute = () => {
              console.warn('[WebRTC] Track muted -', peerId);
            };
          }

          // Fallback: Set screenSharingUser from ontrack event
          // This will be overridden by WebSocket message if it arrives later
          setScreenSharingUser((prevState) => {
            // Try to find participant with flexible ID matching
            const participant = participantsRef.current.find(p =>
              String(p.user.id) === String(peerId)
            );

            const username = participant?.user.name || 'Connecting...';

            console.log('[ScreenShare] Fallback: Setting screen sharing user from ontrack:', {
              peerId,
              username,
              participantFound: !!participant,
              totalParticipants: participantsRef.current.length,
              participantIds: participantsRef.current.map(p => String(p.user.id)),
              prevState
            });

            // Always update to ensure we have a user (even if temporary)
            return { userId: peerId, username };
          });
        } else {
          // Regular camera/audio stream
          const remoteVideo = remoteVideoRefs.current.get(peerId);
          if (remoteVideo) {
            remoteVideo.srcObject = stream;
          }

          // Monitor tracks for network issues
          stream.getTracks().forEach((track) => {
            track.onended = () => {
              console.warn('[WebRTC] Track ended:', peerId, track.kind);
            };
            track.onmute = () => {
              console.warn('[WebRTC] Track muted:', peerId, track.kind);
            };
          });

          setParticipants((prev) =>
            prev.map((p) =>
              p.user.id === peerId ? { ...p, stream: stream } : p
            )
          );
        }
      }
    };

    // Handle ICE connection state changes (for network issues)
    peerConnection.oniceconnectionstatechange = () => {
      const iceState = peerConnection.iceConnectionState;

      if (iceState === 'failed') {
        console.warn('[WebRTC] ICE failed:', peerId);
        handleICERestart(peerId);
      } else if (iceState === 'disconnected') {
        setTimeout(() => {
          if (peerConnection.iceConnectionState === 'disconnected') {
            console.warn('[WebRTC] ICE disconnected, restarting:', peerId);
            handleICERestart(peerId);
          }
        }, 5000);
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      const connState = peerConnection.connectionState;

      if (connState === 'failed') {
        console.error('[WebRTC] Connection failed:', peerId);
        handlePeerReconnection(peerId);
      } else if (connState === 'disconnected') {
        setTimeout(() => {
          if (peerConnection.connectionState === 'disconnected') {
            console.warn('[WebRTC] Connection disconnected, reconnecting:', peerId);
            handlePeerReconnection(peerId);
          }
        }, 5000);
      }
    };

    peerConnectionsRef.current.set(peerId, peerConnection);
    return peerConnection;
  }, [screenStream, isScreenSharing]);

  // WebRTC: Handle WebSocket messages
  const handleWebSocketMessage = useCallback(async (message: WebSocketMessage) => {

    switch (message.type) {
      case 'ready': {
        // Received list of existing peers when we join
        // Don't create offers, existing peers will send offers to us
        break;
      }

      case 'peer-joined': {
        // New peer joined, we (existing peer) should create offer
        const peerData = message.data as { user_id: string; username: string };
        const peerId = peerData.user_id;

        try {
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
        } catch (error) {
          console.error('[WebRTC] Error creating offer for:', peerId, error);
        }
        break;
      }

      case 'offer': {
        // Received offer from peer (could be initial or renegotiation)
        const peerId = message.from!;

        try {
          // Check if peer connection already exists (renegotiation) or needs to be created (initial)
          let peerConnection = peerConnectionsRef.current.get(peerId);

          if (!peerConnection) {
            // Initial connection - create new peer connection
            peerConnection = await createPeerConnection(peerId);
          } else {
            // Renegotiation - use existing peer connection
          }

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
        } catch (error) {
          console.error('[WebRTC] Error handling offer from:', peerId, error);
        }
        break;
      }

      case 'answer': {
        // Received answer to our offer
        const peerId = message.from!;

        try {
          const peerConnection = peerConnectionsRef.current.get(peerId);
          if (peerConnection) {
            await peerConnection.setRemoteDescription(
              new RTCSessionDescription({
                sdp: message.data.sdp,
                type: 'answer',
              })
            );
          } else {
            console.error('[WebRTC] No peer connection found for:', peerId);
          }
        } catch (error) {
          console.error('[WebRTC] Error handling answer from:', peerId, error);
        }
        break;
      }

      case 'ice-candidate': {
        const peerId = message.from!;
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
          } else {
            console.error('[WebRTC] No peer connection for ICE candidate:', peerId);
          }
        } catch (error) {
          console.error('[WebRTC] ICE candidate error:', peerId, error);
        }
        break;
      }

      case 'peer-left': {
        const peerData = message.data as { user_id: string; username: string };
        const peerId = peerData.user_id;

        const peerConnection = peerConnectionsRef.current.get(peerId);
        if (peerConnection) {
          peerConnection.close();
          peerConnectionsRef.current.delete(peerId);
        }
        remoteVideoRefs.current.delete(peerId);
        break;
      }

      case 'media-state-changed': {
        const peerId = message.from!;
        const mediaState = message.data as { is_muted: boolean; is_video_on: boolean };

        setParticipants((prev) =>
          prev.map((p) =>
            p.user.id === peerId
              ? { ...p, is_muted: mediaState.is_muted, is_video_on: mediaState.is_video_on }
              : p
          )
        );
        break;
      }

      case 'join-request-pending': {
        setIsWaitingForApproval(true);
        break;
      }

      case 'pending-join-request': {
        const joinRequest = message.data as JoinRequestInfo;
        setPendingJoinRequests((prev) => [...prev, joinRequest]);
        break;
      }

      case 'join-approved': {
        console.log('[Approval] Join approved - setting isJoinApproved to true');
        setIsWaitingForApproval(false);
        setIsJoinApproved(true);

        if (meeting) {
          joinMeetingAndLoadData(meeting).catch((err) => {
            console.error('[Join] Failed to join after approval:', err);
            setError('Failed to join meeting after approval. Please try again.');
          });
        }
        break;
      }

      case 'join-rejected': {
        setIsWaitingForApproval(false);
        setError('Your join request was rejected by the host');
        break;
      }

      case 'screen-share-started': {
        const { user_id, username } = message.data as { user_id: string; username: string };
        console.log('[ScreenShare] Received screen-share-started message:', { user_id, username });
        // Always override with correct username from WebSocket
        setScreenSharingUser({ userId: user_id, username });
        break;
      }

      case 'screen-share-stopped': {
        const { user_id } = message.data as { user_id: string };
        setScreenSharingUser(null);
        setRemoteScreenStreams((prev) => {
          const newMap = new Map(prev);
          newMap.delete(user_id);
          return newMap;
        });
        break;
      }

      default:
        console.warn('[WebRTC] Unknown message type:', message.type);
    }
  }, [createPeerConnection, meeting, joinMeetingAndLoadData]);

  // WebSocket: Connect for join approval (only after media is ready)
  useEffect(() => {
    if (!meeting?.id || !isMediaReady) return;

    // Create wrapper handlers for join approval
    const joinRequestPendingHandler = (msg: WebSocketMessage) => handleWebSocketMessage(msg);
    const pendingJoinRequestHandler = (msg: WebSocketMessage) => handleWebSocketMessage(msg);
    const joinApprovedHandler = (msg: WebSocketMessage) => handleWebSocketMessage(msg);
    const joinRejectedHandler = (msg: WebSocketMessage) => handleWebSocketMessage(msg);
    // Setup screen share handlers early to not miss messages
    const screenShareStartedHandler = (msg: WebSocketMessage) => handleWebSocketMessage(msg);
    const screenShareStoppedHandler = (msg: WebSocketMessage) => handleWebSocketMessage(msg);

    const connectWebSocket = async () => {
      try {
        await webSocketService.connect(meeting.id);

        // Setup join approval handlers
        webSocketService.on('join-request-pending', joinRequestPendingHandler);
        webSocketService.on('pending-join-request', pendingJoinRequestHandler);
        webSocketService.on('join-approved', joinApprovedHandler);
        webSocketService.on('join-rejected', joinRejectedHandler);
        // Setup screen share handlers early (before approval to catch initial state)
        webSocketService.on('screen-share-started', screenShareStartedHandler);
        webSocketService.on('screen-share-stopped', screenShareStoppedHandler);

        // Check if current user is host
        const isHost = currentUserId === String(meeting.host_id);

        // If not host, send join request
        if (!isHost && currentUserId) {
          const currentUser = await apiService.getMe();
          webSocketService.send({
            type: 'join-request',
            data: {
              host_user_id: String(meeting.host_id),
              email: currentUser.email,
            },
          });
        } else if (isHost) {
          console.log('[Approval] Host joining - setting isJoinApproved to true');
          webSocketService.send({
            type: 'host-join',
            data: {},
          });
          setIsJoinApproved(true);
        }
      } catch (error) {
        console.error('[WebSocket] Failed to connect:', error);
      }
    };

    connectWebSocket();

    return () => {
      // Cleanup join approval listeners
      webSocketService.off('join-request-pending', joinRequestPendingHandler);
      webSocketService.off('pending-join-request', pendingJoinRequestHandler);
      webSocketService.off('join-approved', joinApprovedHandler);
      webSocketService.off('join-rejected', joinRejectedHandler);
      // Cleanup screen share listeners
      webSocketService.off('screen-share-started', screenShareStartedHandler);
      webSocketService.off('screen-share-stopped', screenShareStoppedHandler);
    };
  }, [meeting?.id, isMediaReady, currentUserId, handleWebSocketMessage]);

  // WebSocket: Setup WebRTC handlers (only after join is approved)
  useEffect(() => {
    if (!meeting?.id || !isJoinApproved) return;

    // Create wrapper handlers for WebRTC
    const readyHandler = (msg: WebSocketMessage) => handleWebSocketMessage(msg);
    const peerJoinedHandler = (msg: WebSocketMessage) => handleWebSocketMessage(msg);
    const offerHandler = (msg: WebSocketMessage) => handleWebSocketMessage(msg);
    const answerHandler = (msg: WebSocketMessage) => handleWebSocketMessage(msg);
    const iceCandidateHandler = (msg: WebSocketMessage) => handleWebSocketMessage(msg);
    const peerLeftHandler = (msg: WebSocketMessage) => handleWebSocketMessage(msg);
    const mediaStateChangedHandler = (msg: WebSocketMessage) => handleWebSocketMessage(msg);

    // Setup WebRTC message handlers
    webSocketService.on('ready', readyHandler);
    webSocketService.on('peer-joined', peerJoinedHandler);
    webSocketService.on('offer', offerHandler);
    webSocketService.on('answer', answerHandler);
    webSocketService.on('ice-candidate', iceCandidateHandler);
    webSocketService.on('peer-left', peerLeftHandler);
    webSocketService.on('media-state-changed', mediaStateChangedHandler);
    // Note: screen-share handlers are setup earlier in approval phase

    return () => {
      // Cleanup WebRTC listeners
      webSocketService.off('ready', readyHandler);
      webSocketService.off('peer-joined', peerJoinedHandler);
      webSocketService.off('offer', offerHandler);
      webSocketService.off('answer', answerHandler);
      webSocketService.off('ice-candidate', iceCandidateHandler);
      webSocketService.off('peer-left', peerLeftHandler);
      webSocketService.off('media-state-changed', mediaStateChangedHandler);

      // Close all peer connections
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();

      // Disconnect WebSocket when leaving
      if (!meeting?.id) {
        webSocketService.disconnect();
      }
    };
  }, [meeting?.id, isJoinApproved, handleWebSocketMessage]);

  // Add local tracks to existing peer connections when media becomes ready
  useEffect(() => {
    if (!isMediaReady || !localStreamRef.current) return;

    // Add tracks to all existing peer connections
    peerConnectionsRef.current.forEach((peerConnection) => {
      const senders = peerConnection.getSenders();
      const tracks = localStreamRef.current!.getTracks();

      // Check if tracks are already added
      if (senders.length === 0) {
        tracks.forEach((track) => {
          peerConnection.addTrack(track, localStreamRef.current!);
        });
      }
    });
  }, [isMediaReady]);

  // Initialize media devices
  const initializeMedia = async (audioDeviceId?: string, videoDeviceId?: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
        video: videoDeviceId
          ? {
              deviceId: { exact: videoDeviceId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'user',
            },
      });

      localStreamRef.current = stream;

      // Store current device IDs
      const audioTrack = stream.getAudioTracks()[0];
      const videoTrack = stream.getVideoTracks()[0];
      if (audioTrack) {
        setCurrentAudioDeviceId(audioTrack.getSettings().deviceId || '');
      }
      if (videoTrack) {
        setCurrentVideoDeviceId(videoTrack.getSettings().deviceId || '');
      }

      // Attach stream to video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Setup audio level detection
      setupAudioAnalyser(stream);

      setMediaError(null);
      setIsMediaReady(true);
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
      const newAudioState = !isAudioEnabled;
      audioTracks.forEach((track) => {
        track.enabled = newAudioState;
      });
      setIsAudioEnabled(newAudioState);

      // Broadcast audio state change to other participants (only if approved)
      if (meeting?.id && isJoinApproved) {
        console.log('[Media] Broadcasting audio state change:', { is_muted: !newAudioState, is_video_on: isVideoEnabled });
        webSocketService.send({
          type: 'media-state-changed' as const,
          data: {
            is_muted: !newAudioState,
            is_video_on: isVideoEnabled,
          },
        });
      } else {
        console.warn('[Media] Cannot broadcast audio state - meeting.id:', !!meeting?.id, 'isJoinApproved:', isJoinApproved);
      }
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

      // Replace camera video track with null in all peer connections (preserve screen share)
      peerConnectionsRef.current.forEach((peerConnection, peerId) => {
        const senders = peerConnection.getSenders();

        // Get screen share sender for this peer (if exists)
        const screenShareSender = screenTrackSendersRef.current.get(peerId);

        // Find camera video sender (exclude screen share sender)
        const cameraVideoSender = senders.find(sender =>
          sender !== screenShareSender && // CRITICAL: Don't touch screen share!
          sender.track?.kind === 'video'
        );

        if (cameraVideoSender) {
          console.log('[Video] Removing camera track for peer:', peerId);
          cameraVideoSender.replaceTrack(null);
        }
      });

      // Clear video element to fully release camera
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
        // Re-attach stream without video for audio to continue
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      setIsVideoEnabled(false);

      // Broadcast video state change (only if approved)
      if (meeting?.id && isJoinApproved) {
        console.log('[Media] Broadcasting video OFF state change:', { is_muted: !isAudioEnabled, is_video_on: false });
        webSocketService.send({
          type: 'media-state-changed' as const,
          data: {
            is_muted: !isAudioEnabled,
            is_video_on: false,
          },
        });
      } else {
        console.warn('[Media] Cannot broadcast video OFF - meeting.id:', !!meeting?.id, 'isJoinApproved:', isJoinApproved);
      }
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

        // Replace video track in all peer connections (excluding screen share tracks)
        peerConnectionsRef.current.forEach((peerConnection, peerId) => {
          const senders = peerConnection.getSenders();

          // Get screen share sender for this peer (if exists)
          const screenShareSender = screenTrackSendersRef.current.get(peerId);

          // Find camera video sender (exclude screen share sender)
          const cameraVideoSender = senders.find(sender =>
            sender !== screenShareSender && // CRITICAL: Don't touch screen share!
            (sender.track?.kind === 'video' || (sender.track === null && senders.length > 1))
          );

          if (cameraVideoSender) {
            console.log('[Video] Replacing camera track for peer:', peerId);
            cameraVideoSender.replaceTrack(newVideoTrack);
          } else {
            // If no camera video sender exists, add the new track
            console.log('[Video] Adding new camera track for peer:', peerId);
            peerConnection.addTrack(newVideoTrack, localStreamRef.current!);
          }
        });

        // Update video element
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null;
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        setIsVideoEnabled(true);

        // Broadcast video state change (only if approved)
        if (meeting?.id && isJoinApproved) {
          console.log('[Media] Broadcasting video ON state change:', { is_muted: !isAudioEnabled, is_video_on: true });
          webSocketService.send({
            type: 'media-state-changed' as const,
            data: {
              is_muted: !isAudioEnabled,
              is_video_on: true,
            },
          });
        } else {
          console.warn('[Media] Cannot broadcast video ON - meeting.id:', !!meeting?.id, 'isJoinApproved:', isJoinApproved);
        }
      } catch (err) {
        console.error('Failed to enable video:', err);
        setMediaError('Failed to access camera. Please check permissions.');
      }
    }
  };

  // Switch audio device
  const switchAudioDevice = async (deviceId: string) => {
    if (!localStreamRef.current) return;

    try {
      // Get new audio stream with selected device
      const newAudioStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
      });

      const newAudioTrack = newAudioStream.getAudioTracks()[0];

      // Stop old audio track
      const oldAudioTracks = localStreamRef.current.getAudioTracks();
      oldAudioTracks.forEach((track) => {
        track.stop();
        localStreamRef.current?.removeTrack(track);
      });

      // Add new audio track to local stream
      localStreamRef.current.addTrack(newAudioTrack);

      // Replace audio track in all peer connections
      peerConnectionsRef.current.forEach((peerConnection) => {
        const senders = peerConnection.getSenders();
        const audioSender = senders.find((sender) => sender.track?.kind === 'audio');
        if (audioSender) {
          audioSender.replaceTrack(newAudioTrack);
        } else {
          peerConnection.addTrack(newAudioTrack, localStreamRef.current!);
        }
      });

      // Update audio analyser with new track
      setupAudioAnalyser(localStreamRef.current);

      // Update current device ID
      setCurrentAudioDeviceId(deviceId);

      // Maintain audio enabled state
      newAudioTrack.enabled = isAudioEnabled;
    } catch (err) {
      console.error('Failed to switch audio device:', err);
      setMediaError('Failed to switch microphone. Please try again.');
    }
  };

  // Handle ICE restart for network recovery
  const handleICERestart = async (peerId: string) => {
    const peerConnection = peerConnectionsRef.current.get(peerId);
    if (!peerConnection) return;

    try {
      const offer = await peerConnection.createOffer({ iceRestart: true });
      await peerConnection.setLocalDescription(offer);

      webSocketService.send({
        type: 'offer',
        to: peerId,
        data: {
          sdp: offer.sdp,
          type: offer.type,
        },
      });
    } catch (error) {
      console.error('[WebRTC] ICE restart failed:', peerId, error);
    }
  };

  // Handle full peer reconnection
  const handlePeerReconnection = async (peerId: string) => {
    const peerConnection = peerConnectionsRef.current.get(peerId);
    if (!peerConnection) return;

    try {
      await handleICERestart(peerId);

      setTimeout(async () => {
        if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
          console.warn('[WebRTC] Recreating connection:', peerId);

          peerConnection.close();
          peerConnectionsRef.current.delete(peerId);

          const newPeerConnection = await createPeerConnection(peerId);
          const offer = await newPeerConnection.createOffer();
          await newPeerConnection.setLocalDescription(offer);

          webSocketService.send({
            type: 'offer',
            to: peerId,
            data: {
              sdp: offer.sdp,
              type: offer.type,
            },
          });
        }
      }, 10000);
    } catch (error) {
      console.error('[WebRTC] Reconnection failed:', peerId, error);
    }
  };

  // Retry mechanism for renegotiation with exponential backoff
  const renegotiateWithRetry = async (peerId: string, peerConnection: RTCPeerConnection, maxRetries = 3, retryDelay = 1000) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        webSocketService.send({
          type: 'offer',
          to: peerId,
          data: {
            sdp: offer.sdp,
            type: offer.type,
          },
        });

        return true;
      } catch (error) {
        if (attempt === maxRetries) {
          console.error('[WebRTC] Renegotiation failed after', maxRetries, 'attempts:', peerId, error);
          return false;
        }
        const delay = retryDelay * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    return false;
  };

  // Switch video device
  const switchVideoDevice = async (deviceId: string) => {
    if (!localStreamRef.current || !isVideoEnabled) return;

    try {
      // Get new video stream with selected device
      const newVideoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      const newVideoTrack = newVideoStream.getVideoTracks()[0];

      // Stop old video track
      const oldVideoTracks = localStreamRef.current.getVideoTracks();
      oldVideoTracks.forEach((track) => {
        track.stop();
        localStreamRef.current?.removeTrack(track);
      });

      // Add new video track to local stream
      localStreamRef.current.addTrack(newVideoTrack);

      // Replace camera video track in all peer connections (preserve screen share)
      peerConnectionsRef.current.forEach((peerConnection, peerId) => {
        const senders = peerConnection.getSenders();

        // Get screen share sender for this peer (if exists)
        const screenShareSender = screenTrackSendersRef.current.get(peerId);

        // Find camera video sender (exclude screen share sender)
        const cameraVideoSender = senders.find((sender) =>
          sender !== screenShareSender && // CRITICAL: Don't touch screen share!
          sender.track?.kind === 'video'
        );

        if (cameraVideoSender) {
          console.log('[Video] Switching camera device for peer:', peerId);
          cameraVideoSender.replaceTrack(newVideoTrack);
        } else {
          console.log('[Video] Adding camera track for peer:', peerId);
          peerConnection.addTrack(newVideoTrack, localStreamRef.current!);
        }
      });

      // Update video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      // Update current device ID
      setCurrentVideoDeviceId(deviceId);
    } catch (err) {
      console.error('Failed to switch video device:', err);
      setMediaError('Failed to switch camera. Please try again.');
    }
  };

  // Toggle screen share
  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop screen sharing
      stopScreenShare();

      // Remove screen track from all peer connections and renegotiate
      const stopPromises: Promise<void>[] = [];
      for (const [peerId, sender] of screenTrackSendersRef.current.entries()) {
        const peerConnection = peerConnectionsRef.current.get(peerId);
        if (peerConnection) {
          const stopPromise = (async () => {
            try {
              peerConnection.removeTrack(sender);

              // Renegotiate connection with retry mechanism
              const success = await renegotiateWithRetry(peerId, peerConnection);
              if (!success) {
                console.error('[ScreenShare] Failed to renegotiate stop with peer after retries:', peerId);
              }
            } catch (error) {
              console.error('[ScreenShare] Failed to remove screen track or renegotiate with peer:', peerId, error);
            }
          })();
          stopPromises.push(stopPromise);
        }
      }

      await Promise.all(stopPromises);
      screenTrackSendersRef.current.clear();

      // Notify other participants that screen sharing stopped
      if (meeting?.id) {
        webSocketService.send({
          type: 'screen-share-stopped',
          data: {
            user_id: currentUserId,
          },
        });
      }
    } else {
      // Start screen sharing
      const success = await startScreenShare();
      if (!success && screenShareError) {
        setMediaError(screenShareError);
        return;
      }

      // Wait a bit for screenStream to be available, then renegotiate
      setTimeout(async () => {
        if (screenStream) {
          const screenTrack = screenStream.getVideoTracks()[0];

          if (screenTrack) {
            // Add screen track to all existing peer connections and renegotiate
            for (const [peerId, peerConnection] of peerConnectionsRef.current.entries()) {
              try {
                const sender = peerConnection.addTrack(screenTrack, screenStream);
                screenTrackSendersRef.current.set(peerId, sender);

                // Renegotiate connection with retry mechanism
                const success = await renegotiateWithRetry(peerId, peerConnection);
                if (!success) {
                  console.error('[ScreenShare] Failed to renegotiate with peer after retries:', peerId);
                  // Remove sender if renegotiation failed
                  peerConnection.removeTrack(sender);
                  screenTrackSendersRef.current.delete(peerId);
                }
              } catch (error) {
                console.error('[ScreenShare] Failed to add screen track to peer:', peerId, error);
              }
            }

            // Notify other participants that screen sharing started
            if (meeting?.id && currentUserId) {
              webSocketService.send({
                type: 'screen-share-started',
                data: {
                  user_id: currentUserId,
                  username: currentUserName,
                  timestamp: Date.now(),
                },
              });
            }
          }
        }
      }, 100);
    }
  };

  // Display screen share error
  useEffect(() => {
    if (screenShareError) {
      setMediaError(screenShareError);
    }
  }, [screenShareError]);

  // Sync participants to ref for use in callbacks
  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

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

    // Stop screen sharing if active
    if (isScreenSharing) {
      stopScreenShare();
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

        // Get current user from API to ensure we have correct ID
        const currentUser = await apiService.getMe();
        const currentUserIdStr = String(currentUser.id);
        setCurrentUserId(currentUserIdStr);
        setCurrentUserName(currentUser.name);

        // Check if current user is host
        const isHost = currentUserIdStr === String(meetingData.host_id);

        // If host, join immediately
        if (isHost) {
          await joinMeetingAndLoadData(meetingData);
        }
        // If not host, wait for approval before joining

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

  // Join approval handlers
  const handleApproveJoinRequest = (userId: string) => {
    webSocketService.send({
      type: 'approve-join-request',
      data: {
        user_id: userId,
      },
    });
    // Remove from pending requests
    setPendingJoinRequests((prev) => prev.filter((req) => req.user_id !== userId));
  };

  const handleRejectJoinRequest = (userId: string) => {
    webSocketService.send({
      type: 'reject-join-request',
      data: {
        user_id: userId,
      },
    });
    // Remove from pending requests
    setPendingJoinRequests((prev) => prev.filter((req) => req.user_id !== userId));
  };

  const handleCancelWaiting = () => {
    stopMediaTracks();
    navigate('/');
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !meeting?.id) return;

    try {
      // Send message to backend - will be broadcast via SSE to all participants
      await apiService.sendChatMessage(meeting.id, inputMessage);
      setInputMessage('');
    } catch (error) {
      console.error('[Chat] Failed to send message:', error);
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

  // Waiting for approval state
  if (isWaitingForApproval && !isJoinApproved) {
    return (
      <WaitingForApproval
        meetingTitle={meeting.title}
        onCancel={handleCancelWaiting}
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

      {/* Screen Share Indicator - Only for local sharing */}
      {isScreenSharing && !isScreenShareMinimized && (
        <div className="px-4 py-2">
          <ScreenShareIndicator
            presenterName={currentUserName}
            isLocalShare={true}
            onStopSharing={handleToggleScreenShare}
            onMinimize={() => setIsScreenShareMinimized(true)}
          />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Screen Share View - Takes 70% width when LOCAL user is sharing */}
        {isScreenSharing && !isScreenShareMinimized && (
          <div className="w-full lg:w-[70%] p-2 sm:p-3 md:p-4">
            <ScreenShareView
              stream={screenStream!}
              presenterName={currentUserName}
              isLocalShare={true}
              onMinimize={() => setIsScreenShareMinimized(true)}
            />
          </div>
        )}

        {/* Video grid - Takes remaining space or full width */}
        <div className={`${isScreenSharing && !isScreenShareMinimized ? 'w-full lg:w-[30%]' : 'flex-1'} p-2 sm:p-3 md:p-4 flex flex-col`}>
          {/* Maximize screen share button when minimized - Only for local sharing */}
          {isScreenSharing && isScreenShareMinimized && (
            <div className="mb-2">
              <button
                onClick={() => setIsScreenShareMinimized(false)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center space-x-2 transition-colors"
              >
                <ComputerDesktopIcon className="w-4 h-4" />
                <span>Show your screen share</span>
              </button>
            </div>
          )}

          {/* Grid layout changes based on LOCAL screen share state */}
          {isScreenSharing && !isScreenShareMinimized ? (
            // Local screen share mode: Fixed size tiles with scrolling
            <div className="flex-1 overflow-y-auto overflow-x-hidden pb-24">
              <div className="grid gap-3 justify-center" style={{ gridTemplateColumns: 'repeat(auto-fill, 250px)' }}>
                {/* Local video (You) - Fixed 250x250 in screen share mode */}
                <div className="relative bg-gray-800 rounded-xl overflow-hidden flex items-center justify-center" style={{ width: '250px', height: '250px' }}>
                  {/* Video element - always mounted to prevent re-initialization */}
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-contain ${isVideoEnabled ? 'block' : 'hidden'}`}
                    style={{ transform: 'scaleX(-1)' }}
                  />

                  {/* Placeholder when video is off */}
                  {!isVideoEnabled && (
                    <div className="flex flex-col items-center justify-center absolute inset-0">
                      <Avatar name={currentUserName || 'You'} size="medium" />
                      <span className="text-white text-xs sm:text-sm mt-2">You</span>
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

                {/* Remote participants - Fixed 250x250 in screen share mode */}
                {remoteParticipants.map((participant) => {
                  return (
                    <div
                      key={participant.id}
                      className="relative bg-gray-800 rounded-xl overflow-hidden flex items-center justify-center"
                      style={{ width: '250px', height: '250px' }}
                    >
                  {/* Remote video element - always mounted */}
                  <video
                    ref={(el) => {
                      if (el) {
                        remoteVideoRefs.current.set(participant.user.id, el);
                      }
                    }}
                    autoPlay
                    playsInline
                    className={`w-full h-full object-contain ${participant.stream && participant.is_video_on ? 'block' : 'hidden'}`}
                    style={{ transform: 'scaleX(-1)' }}
                  />

                  {/* Placeholder when video is off or no stream */}
                  {(!participant.stream || !participant.is_video_on) && (
                    <div className="flex flex-col items-center justify-center absolute inset-0">
                      <Avatar name={participant.user.name} size="medium" />
                      <span className="text-white text-xs sm:text-sm mt-2">{participant.user.name}</span>
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
                  );
                })}

                {/* Remote screen share - shown as grid item */}
                {screenSharingUser && !isScreenSharing && remoteScreenStreams.size > 0 && (
                  <div
                    className="relative bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center"
                    style={{ width: '250px', height: '250px' }}
                  >
                    <video
                      ref={(el) => {
                        if (el) {
                          const stream = Array.from(remoteScreenStreams.values())[0];
                          el.srcObject = stream;
                        }
                      }}
                      autoPlay
                      playsInline
                      className="w-full h-full object-contain"
                      style={{ transform: 'scaleX(1)' }}
                    />
                    {/* Screen share indicator overlay */}
                    <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-2">
                      <div className="flex items-center space-x-1">
                        <ComputerDesktopIcon className="w-4 h-4 text-blue-400" />
                        <span className="text-white text-xs font-medium">{screenSharingUser.username}'s screen</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Normal mode: Responsive grid with scrolling
            <div className={`flex-1 ${totalParticipants === 1 ? 'h-full' : 'overflow-y-auto overflow-x-hidden pb-20'}`}>
              <div className={`grid gap-2 sm:gap-3 md:gap-4 ${getGridClass(totalParticipants)} ${totalParticipants === 1 ? 'h-full' : 'auto-rows-fr min-h-full'}`}>
              {/* Local video (You) */}
              <div className="relative bg-gray-800 rounded-xl overflow-hidden flex items-center justify-center">
                {/* Video element - always mounted to prevent re-initialization */}
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full object-contain ${isVideoEnabled ? 'block' : 'hidden'}`}
                  style={{ transform: 'scaleX(-1)' }}
                />

                {/* Placeholder when video is off */}
                {!isVideoEnabled && (
                  <div className="flex flex-col items-center justify-center absolute inset-0">
                    <Avatar name={currentUserName || 'You'} size="medium" />
                    <span className="text-white text-xs sm:text-sm mt-2">You</span>
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
              {remoteParticipants.map((participant) => {
                return (
                  <div
                    key={participant.id}
                    className="relative bg-gray-800 rounded-xl overflow-hidden flex items-center justify-center"
                  >
                    {/* Remote video element - always mounted */}
                    <video
                      ref={(el) => {
                        if (el) {
                          remoteVideoRefs.current.set(participant.user.id, el);
                        }
                      }}
                      autoPlay
                      playsInline
                      className={`w-full h-full object-contain ${participant.stream && participant.is_video_on ? 'block' : 'hidden'}`}
                      style={{ transform: 'scaleX(-1)' }}
                    />

                    {/* Placeholder when video is off or no stream */}
                    {(!participant.stream || !participant.is_video_on) && (
                      <div className="flex flex-col items-center justify-center absolute inset-0">
                        <Avatar name={participant.user.name} size="medium" />
                        <span className="text-white text-xs sm:text-sm mt-2">{participant.user.name}</span>
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
                );
              })}

              {/* Remote screen share - shown as grid item in normal mode */}
              {screenSharingUser && !isScreenSharing && remoteScreenStreams.size > 0 && (
                <div className="relative bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center">
                  <video
                    ref={(el) => {
                      if (el) {
                        const stream = Array.from(remoteScreenStreams.values())[0];
                        el.srcObject = stream;
                      }
                    }}
                    autoPlay
                    playsInline
                    className="w-full h-full object-contain"
                    style={{ transform: 'scaleX(1)' }}
                  />
                  {/* Screen share indicator overlay */}
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-2 sm:p-3">
                    <div className="flex items-center space-x-2">
                      <ComputerDesktopIcon className="w-5 h-5 text-blue-400" />
                      <span className="text-white text-sm font-medium">{screenSharingUser.username}'s screen</span>
                    </div>
                  </div>
                </div>
              )}
              </div>
            </div>
          )}
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
        onToggleScreenShare={handleToggleScreenShare}
        isChatOpen={isChatOpen}
        messageCount={messages.length}
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
        currentAudioDeviceId={currentAudioDeviceId}
        currentVideoDeviceId={currentVideoDeviceId}
        onAudioDeviceChange={switchAudioDevice}
        onVideoDeviceChange={switchVideoDevice}
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

      {/* Join Request Popup for Host */}
      {isCurrentUserHost && (
        <JoinRequestPopup
          requests={pendingJoinRequests}
          onApprove={handleApproveJoinRequest}
          onReject={handleRejectJoinRequest}
        />
      )}
    </div>
  );
};
