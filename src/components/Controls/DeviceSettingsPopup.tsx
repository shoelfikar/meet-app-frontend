import React, { useEffect, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface DeviceSettingsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  currentAudioDeviceId: string;
  currentVideoDeviceId: string;
  onAudioDeviceChange: (deviceId: string) => void;
  onVideoDeviceChange: (deviceId: string) => void;
}

interface MediaDeviceInfoExtended {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

export const DeviceSettingsPopup: React.FC<DeviceSettingsPopupProps> = ({
  isOpen,
  onClose,
  currentAudioDeviceId,
  currentVideoDeviceId,
  onAudioDeviceChange,
  onVideoDeviceChange,
}) => {
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfoExtended[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfoExtended[]>([]);

  useEffect(() => {
    if (isOpen) {
      enumerateDevices();
    }
  }, [isOpen]);

  const enumerateDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      const audioInputs = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.substring(0, 5)}`,
          kind: device.kind,
        }));

      const videoInputs = devices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.substring(0, 5)}`,
          kind: device.kind,
        }));

      setAudioDevices(audioInputs);
      setVideoDevices(videoInputs);
    } catch (error) {
      console.error('Error enumerating devices:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Device Settings</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Microphone Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Microphone
            </label>
            <div className="space-y-2">
              {audioDevices.length === 0 ? (
                <p className="text-sm text-gray-500">No microphone devices found</p>
              ) : (
                audioDevices.map((device) => (
                  <label
                    key={device.deviceId}
                    className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="radio"
                      name="audio-device"
                      value={device.deviceId}
                      checked={currentAudioDeviceId === device.deviceId}
                      onChange={() => onAudioDeviceChange(device.deviceId)}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-3 text-sm text-gray-700">{device.label}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Camera Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Camera
            </label>
            <div className="space-y-2">
              {videoDevices.length === 0 ? (
                <p className="text-sm text-gray-500">No camera devices found</p>
              ) : (
                videoDevices.map((device) => (
                  <label
                    key={device.deviceId}
                    className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="radio"
                      name="video-device"
                      value={device.deviceId}
                      checked={currentVideoDeviceId === device.deviceId}
                      onChange={() => onVideoDeviceChange(device.deviceId)}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-3 text-sm text-gray-700">{device.label}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
