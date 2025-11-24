import React from 'react';
import { XMarkIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';

interface Message {
  id: string;
  sender_name: string;
  message: string;
  created_at: string;
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  inputMessage: string;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) {
    return 'just now';
  } else if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
};

export const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  onClose,
  messages,
  inputMessage,
  onInputChange,
  onSendMessage,
  onKeyDown,
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
      />

      {/* Chat panel */}
      <div className={`
        flex flex-col h-full bg-gray-800 border-gray-700
        fixed md:relative inset-y-0 right-0 z-50
        w-full sm:w-96 md:w-80 lg:w-96
        transform transition-transform duration-300 ease-in-out
        md:transform-none md:border-l
        ${isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-700">
          <h3 className="text-white font-semibold text-base sm:text-lg">Chat</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white active:text-white transition-colors touch-manipulation p-1"
          >
            <XMarkIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 sm:space-y-3">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-400 text-sm">No messages yet</p>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="space-y-0.5 sm:space-y-1">
                <div className="flex items-baseline space-x-2">
                  <span className="text-blue-400 text-xs sm:text-sm font-medium">
                    {message.sender_name}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {formatTime(message.created_at)}
                  </span>
                </div>
                <p className="text-white text-xs sm:text-sm break-words">{message.message}</p>
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <div className="p-3 sm:p-4 border-t border-gray-700 safe-area-inset-bottom">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type a message..."
              className="flex-1 bg-gray-700 text-white rounded-lg px-3 sm:px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={onSendMessage}
              disabled={!inputMessage.trim()}
              className="p-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors touch-manipulation"
            >
              <PaperAirplaneIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ChatPanel;
