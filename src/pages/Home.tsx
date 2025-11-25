import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { VideoCameraIcon, PlusIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { apiService } from '../services';
import { Modal } from '../components/Common/Modal';
import { ProfileAvatar } from '../components/Profile/ProfileAvatar';

export const Home = () => {
  const navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; message: string }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const showError = (title: string, message: string) => {
    setErrorModal({ isOpen: true, title, message });
  };

  const closeErrorModal = () => {
    setErrorModal({ isOpen: false, title: '', message: '' });
  };

  const handleCreateMeeting = async () => {
    setIsCreating(true);
    try {
      const meeting = await apiService.createMeeting({
        title: 'Quick Meeting',
      });
      // Backend returns 'code' not 'meeting_code'
      navigate(`/meeting/${meeting.code}`);
    } catch (error) {
      console.error('Failed to create meeting:', error);
      showError('Error', 'Failed to create meeting. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingCode.trim()) return;

    setIsJoining(true);
    try {
      await apiService.getMeetingByCode(meetingCode);
      navigate(`/meeting/${meetingCode}`);
    } catch (error) {
      console.error('Failed to join meeting:', error);
      showError('Meeting Not Found', 'Please check the meeting code and try again.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col p-4">
      {/* Profile Avatar - Top Right */}
      <div className="absolute top-4 right-4 md:top-6 md:right-6">
        <ProfileAvatar />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="max-w-4xl w-full">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-6">
              <VideoCameraIcon className="w-16 h-16 text-blue-500" />
            </div>
            <h1 className="text-5xl font-bold text-white mb-4">Meet App</h1>
            <p className="text-xl text-gray-400">
              Secure video meetings for everyone
            </p>
          </div>

        {/* Main actions */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Create meeting */}
          <div className="card">
            <div className="flex items-center mb-4">
              <PlusIcon className="w-6 h-6 text-blue-500 mr-2" />
              <h2 className="text-xl font-semibold text-white">New Meeting</h2>
            </div>
            <p className="text-gray-400 mb-6">
              Start an instant meeting with anyone
            </p>
            <button
              onClick={handleCreateMeeting}
              disabled={isCreating}
              className="btn-primary w-full"
            >
              {isCreating ? 'Creating...' : 'Create Meeting'}
            </button>
          </div>

          {/* Join meeting */}
          <div className="card">
            <div className="flex items-center mb-4">
              <ArrowRightOnRectangleIcon className="w-6 h-6 text-green-500 mr-2" />
              <h2 className="text-xl font-semibold text-white">Join Meeting</h2>
            </div>
            <p className="text-gray-400 mb-6">
              Enter a code to join an existing meeting
            </p>
            <form onSubmit={handleJoinMeeting}>
              <input
                type="text"
                value={meetingCode}
                onChange={(e) => setMeetingCode(e.target.value)}
                placeholder="Enter meeting code"
                className="input-field w-full mb-4"
              />
              <button
                type="submit"
                disabled={isJoining || !meetingCode.trim()}
                className="btn-primary w-full"
              >
                {isJoining ? 'Joining...' : 'Join'}
              </button>
            </form>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          <div className="text-center">
            <div className="bg-blue-600 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3">
              <VideoCameraIcon className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-white font-medium mb-2">HD Video & Audio</h3>
            <p className="text-gray-400 text-sm">
              Crystal clear video and audio quality
            </p>
          </div>

          <div className="text-center">
            <div className="bg-green-600 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-white font-medium mb-2">Secure & Private</h3>
            <p className="text-gray-400 text-sm">
              End-to-end encrypted meetings
            </p>
          </div>

          <div className="text-center">
            <div className="bg-purple-600 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-white font-medium mb-2">Up to 50 Participants</h3>
            <p className="text-gray-400 text-sm">
              Host large meetings effortlessly
            </p>
          </div>
        </div>
        </div>
      </div>

      {/* Error Modal */}
      <Modal
        isOpen={errorModal.isOpen}
        onClose={closeErrorModal}
        title={errorModal.title}
        message={errorModal.message}
        buttons={[
          {
            label: 'OK',
            onClick: closeErrorModal,
            variant: 'primary',
          },
        ]}
      />
    </div>
  );
};
