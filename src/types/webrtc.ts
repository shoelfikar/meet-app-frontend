export type SignalType =
  | 'offer'
  | 'answer'
  | 'ice-candidate'
  | 'join'
  | 'leave'
  | 'peer-joined'
  | 'peer-left'
  | 'ready'
  | 'error';

export interface WebSocketMessage<T = any> {
  type: SignalType;
  from?: string;
  to?: string;
  meeting_id?: string;
  data: T;
}

export interface SignalOfferMessage extends WebSocketMessage {
  type: 'offer';
  data: {
    sdp: string;
    type: 'offer';
  };
}

export interface SignalAnswerMessage extends WebSocketMessage {
  type: 'answer';
  data: {
    sdp: string;
    type: 'answer';
  };
}

export interface SignalICECandidateMessage extends WebSocketMessage {
  type: 'ice-candidate';
  data: {
    candidate: string;
    sdpMid: string;
    sdpMLineIndex: number;
  };
}

export interface PeerInfo {
  user_id: string;
  username: string;
}

export interface PeerConnectionConfig {
  iceServers: RTCIceServer[];
}

export interface MediaConstraints {
  audio: boolean | MediaTrackConstraints;
  video: boolean | MediaTrackConstraints;
}
