import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDownIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { apiService } from '../../services';

interface User {
  id: string;
  name: string;
  email: string;
}

export const ProfileAvatar = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Get user info from API
    const fetchUser = async () => {
      try {
        const userData = await apiService.getMe();
        setUser(userData);
      } catch (error) {
        console.error('Failed to fetch user data:', error);
        // If failed to get user, redirect to login
        navigate('/login');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [navigate]);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const getInitials = (name: string): string => {
    const words = name.trim().split(' ');
    if (words.length === 0) return '';
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  };

  const handleLogout = async () => {
    try {
      await apiService.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      navigate('/login');
    }
  };

  if (isLoading) {
    return (
      <div className="w-10 h-10 rounded-full bg-gray-700 animate-pulse" />
    );
  }

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center space-x-2 hover:bg-gray-800 rounded-lg p-2 transition-colors cursor-pointer"
      >
        {/* Avatar with initials */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
          {getInitials(user.name)}
        </div>

        {/* User name - hidden on mobile */}
        <span className="hidden md:block text-white text-sm font-medium max-w-32 truncate">
          {user.name}
        </span>

        {/* Dropdown icon */}
        <ChevronDownIcon
          className={`w-4 h-4 text-gray-400 transition-transform ${
            isDropdownOpen ? 'transform rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown menu */}
      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-gray-800 rounded-lg shadow-lg border border-gray-700 py-2 z-50">
          {/* User info */}
          <div className="px-4 py-3 border-b border-gray-700">
            <p className="text-white font-medium truncate">{user.name}</p>
            <p className="text-gray-400 text-sm truncate">{user.email}</p>
          </div>

          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-2 text-gray-300 hover:bg-gray-700 transition-colors cursor-pointer"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5 mr-3" />
            <span>Logout</span>
          </button>
        </div>
      )}
    </div>
  );
};
