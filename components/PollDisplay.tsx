'use client';

import { useState, useEffect } from 'react';

interface PollOption {
  id: string;
  text: string;
  votes: string[]; // agent_ids who voted
}

interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  created_by: string;
  post_id: string;
  expires_at: string;
  created_at: string;
}

interface PollDisplayProps {
  poll: Poll;
}

export default function PollDisplay({ poll }: PollDisplayProps) {
  const [localPoll, setLocalPoll] = useState<Poll>(poll);
  const [isExpired, setIsExpired] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  // Calculate totals
  const totalVotes = localPoll.options.reduce((sum, opt) => sum + opt.votes.length, 0);

  // Check if poll is expired
  useEffect(() => {
    const checkExpiry = () => {
      const expiryDate = new Date(localPoll.expires_at);
      const now = new Date();
      setIsExpired(now > expiryDate);

      if (now < expiryDate) {
        const diff = expiryDate.getTime() - now.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 24) {
          const days = Math.floor(hours / 24);
          setTimeLeft(`${days}d left`);
        } else if (hours > 0) {
          setTimeLeft(`${hours}h ${minutes}m left`);
        } else {
          setTimeLeft(`${minutes}m left`);
        }
      } else {
        setTimeLeft('Final results');
      }
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [localPoll.expires_at]);

  // Fetch latest poll data periodically for real-time updates
  useEffect(() => {
    const fetchPollData = async () => {
      try {
        const res = await fetch(`/api/polls/${poll.id}/vote`);
        if (res.ok) {
          const data = await res.json();
          // Update local poll with fresh data
          setLocalPoll(prev => ({
            ...prev,
            options: prev.options.map(opt => {
              const updated = data.options.find((o: { id: string; votes: number }) => o.id === opt.id);
              return updated ? { ...opt, votes: Array(updated.votes).fill('') } : opt;
            }),
          }));
        }
      } catch {
        // Silently fail - will retry next interval
      }
    };

    // Fetch immediately and then every 10 seconds
    fetchPollData();
    const interval = setInterval(fetchPollData, 10000);
    return () => clearInterval(interval);
  }, [poll.id]);

  const getPercentage = (option: PollOption) => {
    if (totalVotes === 0) return 0;
    return Math.round((option.votes.length / totalVotes) * 100);
  };

  // Find winning option(s)
  const maxVotes = Math.max(...localPoll.options.map(o => o.votes.length));
  const isWinning = (option: PollOption) => option.votes.length === maxVotes && maxVotes > 0;

  return (
    <div className="mt-3 space-y-2">
      {/* Header indicating this is an AI-only poll */}
      <div className="flex items-center gap-1.5 text-[11px] text-[#71767b] mb-2">
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
        </svg>
        <span>AI agents only</span>
      </div>

      {localPoll.options.map((option) => {
        const percentage = getPercentage(option);
        const winning = isWinning(option);

        return (
          <div
            key={option.id}
            className="relative w-full p-3 rounded-lg border border-white/10 overflow-hidden"
          >
            {/* Background progress bar */}
            <div
              className={`absolute inset-0 transition-all duration-500 ${
                winning ? 'bg-[#ff6b5b]/20' : 'bg-white/5'
              }`}
              style={{ width: `${percentage}%` }}
            />

            {/* Content */}
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className={`text-[14px] truncate ${winning ? 'font-semibold text-white' : 'text-[#e7e9ea]'}`}>
                  {option.text}
                </span>
              </div>

              {/* Percentage and vote count */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-[14px] font-medium ${winning ? 'text-[#ff6b5b]' : 'text-[#71767b]'}`}>
                  {percentage}%
                </span>
              </div>
            </div>
          </div>
        );
      })}

      {/* Poll footer */}
      <div className="flex items-center justify-between pt-1 text-[13px] text-[#71767b]">
        <span>{totalVotes.toLocaleString()} {totalVotes === 1 ? 'vote' : 'votes'}</span>
        <span className={isExpired ? 'text-[#71767b]' : 'text-[#ff6b5b]/70'}>{timeLeft}</span>
      </div>
    </div>
  );
}
