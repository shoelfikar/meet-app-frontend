# Meet App Frontend

Modern video conferencing application built with React, TypeScript, and Tailwind CSS using hybrid architecture (WebSocket + SSE + REST).

## 🚀 Features

- **Real-time Video Calls**: WebRTC peer-to-peer video and audio
- **Live Chat**: Real-time messaging using Server-Sent Events (SSE)
- **Screen Sharing**: Share your screen with other participants
- **Media Controls**: Toggle audio/video, manage settings
- **Responsive Design**: Works on desktop and mobile devices
- **Hybrid Architecture**: Optimized with WebSocket + SSE + REST

## 🛠️ Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **React Router** - Routing
- **Axios** - HTTP client
- **Native WebSocket API** - WebRTC signaling
- **EventSource API** - Server-Sent Events
- **Vite** - Build tool

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Video/          # Video tile, grid components
│   ├── Controls/       # Media control buttons
│   ├── Chat/           # Chat panel components
│   └── Meeting/        # Meeting room components
├── hooks/              # Custom React hooks
│   ├── useSSE.ts       # Server-Sent Events hook
│   ├── useWebSocket.ts # WebSocket hook
│   ├── useMedia.ts     # Camera/Mic access
│   ├── useChat.ts      # Chat functionality
│   └── useMeeting.ts   # Meeting state
├── services/           # API and communication services
│   ├── api.ts          # REST API client
│   ├── sse.ts          # SSE service
│   ├── websocket.ts    # WebSocket service
│   └── webrtc.ts       # WebRTC service
├── store/              # Zustand stores
│   ├── userStore.ts    # User state
│   ├── meetingStore.ts # Meeting state
│   ├── participantStore.ts # Participants
│   └── chatStore.ts    # Chat messages
├── types/              # TypeScript interfaces
├── pages/              # Page components
└── App.tsx             # Main app component
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

## 🔧 Environment Variables

```env
VITE_API_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080
VITE_SSE_URL=http://localhost:8080
VITE_STUN_SERVER=stun:stun.l.google.com:19302
```

## 📦 Available Scripts

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

## 🎨 Custom Tailwind Classes

- `.btn-primary` - Primary button
- `.btn-secondary` - Secondary button
- `.btn-danger` - Danger button
- `.input-field` - Input field
- `.card` - Card container

## 🔄 Communication Architecture

### WebSocket (Signaling Only)
WebRTC signaling (SDP/ICE exchange)

### SSE (Chat & Events)
Chat messages, participant updates, notifications

### REST (CRUD Operations)
Authentication, meeting management, commands

### WebRTC (Media)
Peer-to-peer audio/video streaming

## 📝 Key Hooks

```typescript
// Media access
const { localStream, toggleAudio, toggleVideo } = useMedia();

// Chat
const { messages, sendMessage } = useChat(meetingId);

// Meeting
const { participants, joinMeeting, leaveMeeting } = useMeeting(meetingId);

// SSE events
useSSE(meetingId, { onMessage: (event) => {} });
```

## 🌐 Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 🔐 Security

- JWT authentication
- HTTPS required for WebRTC
- WSS for secure WebSocket
- Input validation

## 📚 Resources

- [React Documentation](https://react.dev)
- [WebRTC API](https://webrtc.org/)
- [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Tailwind CSS](https://tailwindcss.com/)

## 📝 License

MIT License
