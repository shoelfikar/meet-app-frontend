interface AvatarProps {
  name: string;
  size?: 'small' | 'medium' | 'large';
}

export const Avatar = ({ name, size = 'medium' }: AvatarProps) => {
  const getInitials = (name: string): string => {
    const words = name.trim().split(' ');
    if (words.length === 0) return '';
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  };

  const sizeClasses = {
    small: 'w-12 h-12 text-base',
    medium: 'w-16 h-16 text-xl sm:w-20 sm:h-20 sm:text-2xl',
    large: 'w-20 h-20 text-2xl md:w-24 md:h-24 md:text-3xl',
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold`}
    >
      {getInitials(name)}
    </div>
  );
};
