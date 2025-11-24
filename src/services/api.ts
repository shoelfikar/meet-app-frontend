import axios, { type AxiosInstance, type AxiosRequestConfig, AxiosError } from 'axios';
import type { AuthResponse, LoginCredentials, RegisterData } from '../types';

const API_URL = import.meta.env.VITE_API_URL || `http://${location.host}`;

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_URL}/api`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor untuk menambahkan token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor untuk handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          localStorage.removeItem('token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { data } = await this.client.post<AuthResponse>('/auth/login', credentials);
    if (data.access_token) {
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
    }
    return data;
  }

  async register(userData: RegisterData): Promise<AuthResponse> {
    const { data } = await this.client.post<AuthResponse>('/auth/register', userData);
    if (data.access_token) {
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
    }
    return data;
  }

  async logout(): Promise<void> {
    await this.client.post('/auth/logout');
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
  }

  async getMe() {
    const { data } = await this.client.get('/auth/me');
    return data;
  }

  // Meeting endpoints
  async createMeeting(meetingData: { title: string; scheduled_at?: string }) {
    const { data } = await this.client.post('/meetings', meetingData);
    return data;
  }

  async getMeetingByCode(code: string) {
    const { data } = await this.client.get(`/meetings/code/${code}`);
    return data;
  }

  async joinMeeting(code: string) {
    const { data } = await this.client.post('/meetings/join', { code });
    return data;
  }

  async leaveMeeting(id: string) {
    const { data } = await this.client.post(`/meetings/${id}/leave`);
    return data;
  }

  async getParticipants(meetingId: string) {
    const { data } = await this.client.get(`/meetings/${meetingId}/participants`);
    return data;
  }

  // Chat endpoints
  async sendChatMessage(meetingId: string, message: string) {
    const { data } = await this.client.post(`/meetings/${meetingId}/messages`, {
      content: message,
      type: 'text'
    });
    return data;
  }

  async getChatHistory(meetingId: string) {
    const { data } = await this.client.get(`/meetings/${meetingId}/messages`);
    return data;
  }

  // Recording endpoints
  async startRecording(meetingId: string) {
    const { data } = await this.client.post(`/meetings/${meetingId}/recording/start`);
    return data;
  }

  async stopRecording(meetingId: string) {
    const { data } = await this.client.post(`/meetings/${meetingId}/recording/stop`);
    return data;
  }

  async getRecording(recordingId: string) {
    const { data } = await this.client.get(`/recordings/${recordingId}`);
    return data;
  }

  // Media controls
  async updateAudioStatus(meetingId: string, userId: string, isMuted: boolean) {
    const { data } = await this.client.patch(
      `/meetings/${meetingId}/participants/${userId}/audio`,
      { is_muted: isMuted }
    );
    return data;
  }

  async updateVideoStatus(meetingId: string, userId: string, isVideoOff: boolean) {
    const { data } = await this.client.patch(
      `/meetings/${meetingId}/participants/${userId}/video`,
      { is_video_off: isVideoOff }
    );
    return data;
  }

  // Generic request method
  async request<T>(config: AxiosRequestConfig): Promise<T> {
    const { data } = await this.client.request<T>(config);
    return data;
  }
}

export const apiService = new ApiService();
export default apiService;
