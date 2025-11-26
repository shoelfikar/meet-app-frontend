import React, { useState } from 'react';
import { ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline';

interface HeaderProps {
  title: string;
  code: string;
  totalParticipants: number;
  status: string;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  code,
  totalParticipants,
  status,
}) => {
  const [copied, setCopied] = useState(false);

  const copyMeetingCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);

      // Reset copied state after 2 seconds
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error('[Header] Failed to copy meeting code:', error);
    }
  };

  return (
    <div className="bg-gray-800 border-b border-gray-700 px-2 py-1.5 sm:px-4 sm:py-2">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-white font-semibold text-sm sm:text-base truncate">{title}</h2>
          <div className="flex items-center space-x-2 hidden sm:flex">
            <p className="text-gray-400 text-xs">Code: {code}</p>
            <button
              onClick={copyMeetingCode}
              className="group relative p-1 hover:bg-gray-700 rounded transition-colors"
              title={copied ? 'Copied!' : 'Copy meeting code'}
            >
              {copied ? (
                <CheckIcon className="w-4 h-4 text-green-500" />
              ) : (
                <ClipboardDocumentIcon className="w-4 h-4 text-gray-400 group-hover:text-white" />
              )}
              {copied && (
                <span className="absolute left-1/2 -translate-x-1/2 -bottom-7 bg-gray-900 text-green-500 text-xs px-2 py-1 rounded whitespace-nowrap">
                  Copied!
                </span>
              )}
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
          {/* Copy button for mobile */}
          <button
            onClick={copyMeetingCode}
            className="group relative p-1.5 hover:bg-gray-700 rounded transition-colors sm:hidden"
            title={copied ? 'Copied!' : 'Copy meeting code'}
          >
            {copied ? (
              <CheckIcon className="w-4 h-4 text-green-500" />
            ) : (
              <ClipboardDocumentIcon className="w-4 h-4 text-gray-400 group-hover:text-white" />
            )}
            {copied && (
              <span className="absolute left-1/2 -translate-x-1/2 -bottom-7 bg-gray-900 text-green-500 text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                Copied!
              </span>
            )}
          </button>

          <span className="text-gray-400 text-xs hidden md:inline">
            {totalParticipants} participant{totalParticipants !== 1 ? 's' : ''}
          </span>
          <span className="text-gray-400 text-xs md:hidden">
            {totalParticipants}
          </span>
          <span className="flex items-center text-green-500 text-xs">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1 sm:mr-1.5 animate-pulse"></span>
            <span className="hidden sm:inline">{status === 'active' ? 'Live' : status}</span>
          </span>
        </div>
      </div>
    </div>
  );
};
