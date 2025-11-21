export interface Meeting {
  id: string;
  code: string; // Changed from meeting_code to match backend
  title: string;
  description: string;
  host_id: string;
  host: {
    id: string;
    email: string;
    username: string;
    name: string;
    avatar_url: string;
    created_at: string;
  };
  status: 'scheduled' | 'active' | 'ended'; // Changed ongoing to active
  scheduled_at?: string;
  started_at?: string;
  ended_at?: string;
  max_users: number;
  is_recording: boolean;
  recording_url?: string;
  settings: {
    allow_chat: boolean;
    allow_screen_share: boolean;
    mute_on_join: boolean;
    video_on_join: boolean;
    waiting_room_enabled: boolean;
    recording_enabled: boolean;
  };
  created_at: string;
}

export interface CreateMeetingData {
  title: string;
  scheduled_at?: string;
  duration?: number;
}

export interface MeetingParticipant {
  id: string;
  meeting_id: string;
  user: {
    id: string;
    email: string;
    username: string;
    name: string;
    avatar_url: string;
    created_at: string;
  };
  role: 'host' | 'co_host' | 'participant';
  joined_at: string;
  left_at?: string;
  is_muted: boolean;
  is_video_on: boolean;
  is_sharing: boolean;
  // WebRTC properties (client-side only)
  stream?: MediaStream;
  peer_connection?: RTCPeerConnection;
}

export interface MeetingSettings {
  video_quality: '360p' | '720p' | '1080p';
  audio_bitrate: number;
  enable_chat: boolean;
  enable_screen_share: boolean;
  enable_recording: boolean;
}
