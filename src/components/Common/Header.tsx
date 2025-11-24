import React from 'react';

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
  return (
    <div className="bg-gray-800 border-b border-gray-700 px-2 py-1.5 sm:px-4 sm:py-2">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-white font-semibold text-sm sm:text-base truncate">{title}</h2>
          <p className="text-gray-400 text-xs hidden sm:block">Code: {code}</p>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
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
