import { UserCircleIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import type { JoinRequestInfo } from '../../types/webrtc';
import { Avatar } from '../Common/Avatar';

interface JoinRequestPopupProps {
  requests: JoinRequestInfo[];
  onApprove: (userId: string) => void;
  onReject: (userId: string) => void;
}

export const JoinRequestPopup = ({ requests, onApprove, onReject }: JoinRequestPopupProps) => {
  if (requests.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 w-80 sm:w-96">
      <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-700">
          <h3 className="text-white font-semibold text-sm sm:text-base flex items-center">
            <UserCircleIcon className="w-5 h-5 mr-2" />
            Join Requests ({requests.length})
          </h3>
        </div>

        {/* Request list */}
        <div className="max-h-96 overflow-y-auto">
          {requests.map((request) => (
            <div
              key={request.user_id}
              className="px-4 py-3 border-b border-gray-700 last:border-b-0"
            >
              <div className="flex items-start space-x-3">
                {/* Avatar */}
                <div className="flex-shrink-0 pt-1">
                  <Avatar name={request.username} size="small" />
                </div>

                {/* User info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">
                    {request.username}
                  </p>
                  <p className="text-gray-400 text-xs truncate">
                    {request.email}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    {new Date(request.timestamp * 1000).toLocaleTimeString()}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex space-x-2 mt-3">
                <button
                  onClick={() => onApprove(request.user_id)}
                  className="flex-1 flex items-center justify-center px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <CheckIcon className="w-4 h-4 mr-1" />
                  Approve
                </button>
                <button
                  onClick={() => onReject(request.user_id)}
                  className="flex-1 flex items-center justify-center px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-4 h-4 mr-1" />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
