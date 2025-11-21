import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface ModalButton {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  children?: React.ReactNode;
  buttons?: ModalButton[];
  showCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  children,
  buttons,
  showCloseButton = false,
}) => {
  if (!isOpen) return null;

  const getButtonClass = (variant: ModalButton['variant'] = 'secondary') => {
    const baseClass = 'flex-1 px-4 py-2 rounded-lg transition-colors cursor-pointer font-medium';

    switch (variant) {
      case 'primary':
        return `${baseClass} bg-blue-600 hover:bg-blue-700 text-white`;
      case 'danger':
        return `${baseClass} bg-red-600 hover:bg-red-700 text-white`;
      case 'secondary':
      default:
        return `${baseClass} bg-gray-700 hover:bg-gray-600 text-white`;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white text-lg font-semibold">{title}</h3>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        {message && <p className="text-gray-400 mb-6">{message}</p>}
        {children && <div className="mb-6">{children}</div>}

        {/* Buttons */}
        {buttons && buttons.length > 0 && (
          <div className="flex space-x-3">
            {buttons.map((button, index) => (
              <button
                key={index}
                onClick={button.onClick}
                className={getButtonClass(button.variant)}
              >
                {button.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
