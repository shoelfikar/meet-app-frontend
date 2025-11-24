import React from 'react';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export type ErrorType = 'error' | 'not-found' | 'warning';

interface ErrorMessageProps {
  type?: ErrorType;
  title: string;
  message?: string;
  buttonText?: string;
  onButtonClick?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  type = 'error',
  title,
  message,
  buttonText = 'Back to Home',
  onButtonClick,
}) => {
  const getIcon = () => {
    switch (type) {
      case 'error':
        return (
          <div className="bg-red-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <XMarkIcon className="w-10 h-10 text-white" />
          </div>
        );
      case 'not-found':
        return (
          <div className="bg-yellow-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <ExclamationTriangleIcon className="w-10 h-10 text-white" />
          </div>
        );
      case 'warning':
        return (
          <div className="bg-orange-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <ExclamationTriangleIcon className="w-10 h-10 text-white" />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        {getIcon()}

        <h2 className="text-white text-xl sm:text-2xl font-semibold mb-2">
          {title}
        </h2>

        {message && (
          <p className="text-gray-400 text-sm sm:text-base mb-6">
            {message}
          </p>
        )}

        {onButtonClick && (
          <button
            onClick={onButtonClick}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-700 text-white rounded-lg transition-colors font-medium touch-manipulation"
          >
            {buttonText}
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorMessage;
