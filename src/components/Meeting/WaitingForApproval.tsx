import { ClockIcon } from '@heroicons/react/24/outline';

interface WaitingForApprovalProps {
  meetingTitle: string;
  onCancel: () => void;
}

export const WaitingForApproval = ({ meetingTitle, onCancel }: WaitingForApprovalProps) => {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-gray-800 rounded-xl shadow-xl border border-gray-700 p-6 sm:p-8">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
              <ClockIcon className="w-8 h-8 text-white animate-pulse" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl sm:text-2xl font-bold text-white text-center mb-2">
            Waiting for Host Approval
          </h2>

          {/* Meeting title */}
          <p className="text-gray-400 text-center mb-4">
            Meeting: <span className="text-white font-medium">{meetingTitle}</span>
          </p>

          {/* Message */}
          <div className="bg-gray-900 rounded-lg p-4 mb-6">
            <p className="text-gray-300 text-sm text-center">
              Your join request has been sent to the host. Please wait while the host reviews your request.
            </p>
          </div>

          {/* Loading indicator */}
          <div className="flex justify-center mb-6">
            <div className="flex space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>

          {/* Cancel button */}
          <button
            onClick={onCancel}
            className="w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
