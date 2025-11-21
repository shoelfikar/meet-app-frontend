import { webSocketService } from './websocket';
import type { PeerConnectionConfig } from '../types';

const STUN_SERVER = import.meta.env.VITE_STUN_SERVER || 'stun:stun.l.google.com:19302';

export class WebRTCService {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private config: PeerConnectionConfig = {
    iceServers: [
      {
        urls: STUN_SERVER,
      },
    ],
  };

  async getLocalStream(constraints: MediaStreamConstraints): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStream = stream;
      return stream;
    } catch (error) {
      console.error('Failed to get local stream:', error);
      throw error;
    }
  }

  async getScreenStream(): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      this.screenStream = stream;
      return stream;
    } catch (error) {
      console.error('Failed to get screen stream:', error);
      throw error;
    }
  }

  stopScreenShare(): void {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => track.stop());
      this.screenStream = null;
    }
  }

  toggleAudio(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  toggleVideo(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  async createPeerConnection(peerId: string): Promise<RTCPeerConnection> {
    const peerConnection = new RTCPeerConnection(this.config);

    // Add local stream tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, this.localStream!);
      });
    }

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        webSocketService.send({
          type: 'signal_ice_candidate',
          data: {
            candidate: event.candidate.toJSON(),
            from_peer_id: this.getLocalPeerId(),
            to_peer_id: peerId,
          },
        });
      }
    };

    // Handle connection state change
    peerConnection.onconnectionstatechange = () => {
      console.log(`Peer ${peerId} connection state:`, peerConnection.connectionState);

      if (peerConnection.connectionState === 'disconnected') {
        this.closePeerConnection(peerId);
      }
    };

    // Handle ICE connection state change
    peerConnection.oniceconnectionstatechange = () => {
      console.log(`Peer ${peerId} ICE connection state:`, peerConnection.iceConnectionState);
    };

    this.peerConnections.set(peerId, peerConnection);
    return peerConnection;
  }

  async createOffer(peerId: string): Promise<RTCSessionDescriptionInit> {
    let peerConnection = this.peerConnections.get(peerId);

    if (!peerConnection) {
      peerConnection = await this.createPeerConnection(peerId);
    }

    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });

    await peerConnection.setLocalDescription(offer);

    return offer;
  }

  async handleOffer(
    peerId: string,
    offer: RTCSessionDescriptionInit
  ): Promise<RTCSessionDescriptionInit> {
    let peerConnection = this.peerConnections.get(peerId);

    if (!peerConnection) {
      peerConnection = await this.createPeerConnection(peerId);
    }

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    return answer;
  }

  async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const peerConnection = this.peerConnections.get(peerId);

    if (peerConnection) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  async handleICECandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const peerConnection = this.peerConnections.get(peerId);

    if (peerConnection) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  getRemoteStream(peerId: string): MediaStream | null {
    const peerConnection = this.peerConnections.get(peerId);

    if (!peerConnection) {
      return null;
    }

    const remoteStream = new MediaStream();
    peerConnection.getReceivers().forEach((receiver) => {
      if (receiver.track) {
        remoteStream.addTrack(receiver.track);
      }
    });

    return remoteStream;
  }

  closePeerConnection(peerId: string): void {
    const peerConnection = this.peerConnections.get(peerId);

    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(peerId);
    }
  }

  closeAllConnections(): void {
    this.peerConnections.forEach((peerConnection) => {
      peerConnection.close();
    });
    this.peerConnections.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => track.stop());
      this.screenStream = null;
    }
  }

  private getLocalPeerId(): string {
    // This should be replaced with actual user ID
    return localStorage.getItem('user_id') || 'unknown';
  }
}

export const webRTCService = new WebRTCService();
export default webRTCService;
