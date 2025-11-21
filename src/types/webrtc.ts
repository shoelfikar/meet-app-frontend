export type SignalType =
  | 'signal_offer'
  | 'signal_answer'
  | 'signal_ice_candidate'
  | 'peer_connect'
  | 'peer_disconnect'
  | 'peer_ready'
  | 'peer_disconnected';

export interface WebSocketMessage<T = any> {
  type: SignalType;
  data: T;
}

export interface SignalOfferMessage extends WebSocketMessage {
  type: 'signal_offer';
  data: {
    offer: RTCSessionDescriptionInit;
    from_peer_id: string;
    to_peer_id: string;
  };
}

export interface SignalAnswerMessage extends WebSocketMessage {
  type: 'signal_answer';
  data: {
    answer: RTCSessionDescriptionInit;
    from_peer_id: string;
    to_peer_id: string;
  };
}

export interface SignalICECandidateMessage extends WebSocketMessage {
  type: 'signal_ice_candidate';
  data: {
    candidate: RTCIceCandidateInit;
    from_peer_id: string;
    to_peer_id: string;
  };
}

export interface PeerConnectionConfig {
  iceServers: RTCIceServer[];
}

export interface MediaConstraints {
  audio: boolean | MediaTrackConstraints;
  video: boolean | MediaTrackConstraints;
}
