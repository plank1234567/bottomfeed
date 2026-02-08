'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PostModalHeader, PostBody, ReplyCard, EngagementPopup } from './post-modal';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import { useModalKeyboard } from '@/hooks/useModalKeyboard';
import type { Post } from '@/types';

interface PostModalProps {
  postId: string;
  onClose: () => void;
  initialPost?: Post;
}

export default function PostModal({ postId, onClose, initialPost }: PostModalProps) {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [post, setPost] = useState<Post | null>(initialPost || null);
  const [replies, setReplies] = useState<Post[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [engagementTarget, setEngagementTarget] = useState<{
    postId: string;
    type: 'likes' | 'reposts';
  } | null>(null);

  const fetchPost = useCallback(() => {
    setLoadError(false);
    setLoadingReplies(true);
    fetchWithTimeout(`/api/posts/${postId}`)
      .then(res => {
        if (!res.ok) {
          return Promise.reject(new Error(`HTTP ${res.status}`));
        }
        return res.json();
      })
      .then(json => {
        const data = json.data || json;
        if (!initialPost) {
          setPost(data.post);
        }
        setReplies(data.replies || []);
        setLoadingReplies(false);
        fetchWithTimeout(`/api/posts/${postId}/view`, { method: 'POST' }, 5000).catch(() => {});
      })
      .catch(() => {
        setLoadError(true);
        setLoadingReplies(false);
      });
  }, [postId, initialPost]);

  useEffect(() => {
    fetchPost();
  }, [postId, fetchPost]);

  const handleEscape = useCallback(() => {
    if (engagementTarget) {
      setEngagementTarget(null);
    } else {
      onClose();
    }
  }, [engagementTarget, onClose]);

  useModalKeyboard(modalRef, handleEscape);

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement as HTMLElement;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = '';
      if (previouslyFocusedRef.current) {
        previouslyFocusedRef.current.focus();
        previouslyFocusedRef.current = null;
      }
    };
  }, []);

  const showEngagements = (targetPostId: string, type: 'likes' | 'reposts') => {
    setEngagementTarget({ postId: targetPostId, type });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-modal-title"
      aria-describedby="post-modal-description"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#5b708366] animate-backdrop-enter"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        id="post-modal-dialog"
        className="relative w-full max-w-[600px] max-h-[90vh] mt-[5vh] bg-[--card-bg-dark] rounded-2xl overflow-hidden flex flex-col border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-modal-enter"
      >
        <PostModalHeader postType={post?.post_type} onClose={onClose} />
        <h2 id="post-modal-title" className="sr-only">
          {post ? `Post by ${post.author?.display_name}` : 'Loading post'}
        </h2>

        <div className="flex-1 overflow-y-auto">
          {!post && loadingReplies ? (
            <div className="flex justify-center py-12" role="status" aria-label="Loading post">
              <div
                className="w-8 h-8 border-2 border-[--accent] border-t-transparent rounded-full animate-spin"
                aria-hidden="true"
              />
              <span className="sr-only">Loading post...</span>
            </div>
          ) : !post ? (
            <div className="text-center py-12" role="alert">
              <p className="text-[--text-muted] mb-3">
                {loadError ? 'Failed to load post' : 'Post not found'}
              </p>
              {loadError && (
                <button
                  onClick={fetchPost}
                  className="px-4 py-2 text-sm font-medium text-white bg-[--accent] hover:bg-[--accent-hover] rounded-full transition-colors"
                >
                  Try again
                </button>
              )}
            </div>
          ) : (
            <>
              <PostBody
                post={post}
                postId={postId}
                onClose={onClose}
                onShowEngagements={type => showEngagements(postId, type)}
              />

              {/* Replies */}
              <div>
                {loadingReplies ? (
                  <div
                    className="flex justify-center py-8"
                    role="status"
                    aria-label="Loading replies"
                  >
                    <div
                      className="w-5 h-5 border-2 border-[--accent] border-t-transparent rounded-full animate-spin"
                      aria-hidden="true"
                    />
                    <span className="sr-only">Loading replies...</span>
                  </div>
                ) : replies.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-[--text-muted] text-sm">No replies yet</p>
                  </div>
                ) : (
                  replies.map(reply => (
                    <ReplyCard
                      key={reply.id}
                      reply={reply}
                      onClose={onClose}
                      onShowEngagements={showEngagements}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {engagementTarget && (
        <EngagementPopup
          type={engagementTarget.type}
          postId={engagementTarget.postId}
          onClose={() => setEngagementTarget(null)}
          onNavigate={onClose}
        />
      )}
    </div>
  );
}
