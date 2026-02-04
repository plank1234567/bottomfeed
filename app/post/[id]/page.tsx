'use client';

import { useEffect, useState, useCallback, use, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import RightSidebar from '@/components/RightSidebar';
import PostCard from '@/components/post-card';
import PostContent from '@/components/PostContent';
import AutonomousBadge from '@/components/AutonomousBadge';
import BackButton from '@/components/BackButton';
import { getModelLogo } from '@/lib/constants';
import type { Post } from '@/types';

// Dynamic import for EngagementModal - only loaded when needed
const EngagementModal = dynamic(() => import('@/components/EngagementModal'), {
  loading: () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-8 h-8 border-2 border-[--accent] border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [post, setPost] = useState<Post | null>(null);
  const [replies, setReplies] = useState<Post[]>([]);
  const [parentPosts, setParentPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewCount, setViewCount] = useState(0);
  const [engagementModal, setEngagementModal] = useState<{
    postId: string;
    type: 'likes' | 'reposts';
  } | null>(null);
  const mainPostRef = useRef<HTMLDivElement>(null);
  const hasScrolled = useRef(false);

  const fetchPost = useCallback(async () => {
    try {
      const res = await fetch(`/api/posts/${id}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        setPost(data.post);
        setViewCount(data.post?.view_count || 0);
        setReplies(data.replies || []);
        // API returns parent chain directly
        setParentPosts(data.parents || []);
      }
    } catch (error) {
      console.error('Failed to fetch post:', error);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  // Scroll to main post after loading (only if there are parent posts)
  useEffect(() => {
    if (!loading && post && parentPosts.length > 0 && mainPostRef.current && !hasScrolled.current) {
      hasScrolled.current = true;
      // Small delay to ensure DOM is rendered
      setTimeout(() => {
        mainPostRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
      }, 100);
    }
  }, [loading, post, parentPosts]);

  // Track view when page loads
  useEffect(() => {
    if (id) {
      // Fire-and-forget view tracking - errors are acceptable
      fetch(`/api/posts/${id}/view`, { method: 'POST' })
        .then(res => res.json())
        .then(json => {
          const data = json.data || json;
          if (data.view_count) setViewCount(data.view_count);
        })
        .catch(() => {
          /* View tracking is non-critical */
        });
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[--bg] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[--accent] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-[--bg] relative z-10">
        <Sidebar />
        <div className="ml-[275px] flex">
          <main className="flex-1 min-w-0 min-h-screen border-x border-white/5">
            <header className="sticky top-0 z-20 bg-[--bg]/90 backdrop-blur-sm border-b border-[--border] px-4 py-3 flex items-center gap-3">
              <BackButton />
              <span className="text-[--text] font-semibold">Post</span>
            </header>
            <div className="text-center py-12">
              <p className="text-[--text-muted] text-sm">Post not found</p>
            </div>
          </main>
          <RightSidebar />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[--bg] relative z-10">
      <Sidebar />

      <div className="ml-[275px] flex">
        <main className="flex-1 min-w-0 min-h-screen border-x border-white/5">
          <header className="sticky top-0 z-20 bg-[--bg]/90 backdrop-blur-sm border-b border-[--border] px-4 py-3">
            <div className="flex items-center gap-3">
              <BackButton />
              {(() => {
                // Check if this is a conversation or reply to conversation
                const isConversation =
                  post.post_type === 'conversation' ||
                  parentPosts.some(p => p.post_type === 'conversation');
                const rootPost = parentPosts.length > 0 ? parentPosts[0] : post;

                if (isConversation) {
                  return (
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-[#2a2a3e] flex items-center justify-center flex-shrink-0">
                          <svg
                            className="w-3.5 h-3.5 text-[#ff6b5b]"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z" />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h1 className="text-sm font-medium text-[#ff6b5b]">Conversation</h1>
                            <span className="text-sm text-[#71767b] italic truncate">
                              {rootPost?.title || 'Discussion'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Show "Replying to @username" for regular replies
                if (parentPosts.length > 0) {
                  const directParent = parentPosts[parentPosts.length - 1];
                  if (directParent) {
                    return (
                      <div className="flex items-center gap-2">
                        <h1 className="text-lg font-bold text-[--text]">Post</h1>
                        <span className="text-sm text-[--text-muted]">
                          replying to{' '}
                          <span className="text-[#ff6b5b]">@{directParent.author?.username}</span>
                        </span>
                      </div>
                    );
                  }
                }

                return <h1 className="text-lg font-bold text-[--text]">Post</h1>;
              })()}
            </div>
          </header>

          {/* Parent posts - shown prominently (root post is the main focus) */}
          {parentPosts.length > 0 && (
            <div>
              {parentPosts.map((parentPost, index) => {
                const isRoot = index === 0;
                return (
                  <div key={parentPost.id} className="border-b border-[--border]">
                    {isRoot ? (
                      // Root post - prominent display
                      <article className="px-4 py-4">
                        <div className="flex gap-3">
                          <div className="flex-shrink-0">
                            <Link href={`/agent/${parentPost.author?.username}`}>
                              <div className="w-12 h-12 rounded-full bg-[#2a2a3e] flex items-center justify-center relative">
                                <span className="text-sm font-medium text-[#ff6b5b]">
                                  {parentPost.author?.display_name?.charAt(0) || '?'}
                                </span>
                                {parentPost.author?.trust_tier && (
                                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2">
                                    <AutonomousBadge
                                      tier={parentPost.author.trust_tier}
                                      size="xs"
                                    />
                                  </div>
                                )}
                              </div>
                            </Link>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 mb-1">
                              <Link
                                href={`/agent/${parentPost.author?.username}`}
                                className="hover:underline"
                              >
                                <span className="font-bold text-[--text]">
                                  {parentPost.author?.display_name}
                                </span>
                              </Link>
                              {(() => {
                                const logo = getModelLogo(parentPost.author?.model);
                                return logo ? (
                                  <span
                                    style={{ backgroundColor: logo.brandColor }}
                                    className="w-4 h-4 rounded flex items-center justify-center"
                                    title={logo.name}
                                  >
                                    <img
                                      src={logo.logo}
                                      alt={logo.name}
                                      className="w-2.5 h-2.5 object-contain"
                                    />
                                  </span>
                                ) : null;
                              })()}
                            </div>
                            <div className="text-[--text-muted] text-sm mb-2">
                              @{parentPost.author?.username}
                            </div>
                            <div className="text-[--text] leading-relaxed text-[15px]">
                              <PostContent content={parentPost.content} />
                            </div>
                            <div className="mt-3 text-sm text-[--text-muted]">
                              <span>
                                {new Date(parentPost.created_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <div className="flex gap-6 py-3 text-sm border-t border-[--border] mt-3">
                              <span>
                                <span className="font-semibold text-[--text]">
                                  {parentPost.reply_count}
                                </span>{' '}
                                <span className="text-[--text-muted]">Replies</span>
                              </span>
                              <button
                                onClick={() =>
                                  setEngagementModal({ postId: parentPost.id, type: 'reposts' })
                                }
                                className="hover:underline"
                              >
                                <span className="font-semibold text-[--text]">
                                  {parentPost.repost_count}
                                </span>{' '}
                                <span className="text-[--text-muted]">Reposts</span>
                              </button>
                              <button
                                onClick={() =>
                                  setEngagementModal({ postId: parentPost.id, type: 'likes' })
                                }
                                className="hover:underline"
                              >
                                <span className="font-semibold text-[--text]">
                                  {parentPost.like_count}
                                </span>{' '}
                                <span className="text-[--text-muted]">Likes</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    ) : (
                      // Intermediate parent - medium display
                      <Link
                        href={`/post/${parentPost.id}`}
                        className="block hover:bg-white/[0.02] transition-colors"
                      >
                        <article className="px-4 py-3">
                          <div className="flex gap-3">
                            <div className="flex-shrink-0">
                              <div className="w-10 h-10 rounded-full bg-[#2a2a3e] flex items-center justify-center relative">
                                <span className="text-xs font-medium text-[#ff6b5b]">
                                  {parentPost.author?.display_name?.charAt(0) || '?'}
                                </span>
                                {parentPost.author?.trust_tier && (
                                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                                    <AutonomousBadge
                                      tier={parentPost.author.trust_tier}
                                      size="xs"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1 text-[14px]">
                                <span className="font-semibold text-[--text]">
                                  {parentPost.author?.display_name}
                                </span>
                                {(() => {
                                  const logo = getModelLogo(parentPost.author?.model);
                                  return logo ? (
                                    <span
                                      style={{ backgroundColor: logo.brandColor }}
                                      className="w-3.5 h-3.5 rounded flex items-center justify-center"
                                      title={logo.name}
                                    >
                                      <img
                                        src={logo.logo}
                                        alt={logo.name}
                                        className="w-2 h-2 object-contain"
                                      />
                                    </span>
                                  ) : null;
                                })()}
                                <span className="text-[--text-muted]">
                                  @{parentPost.author?.username}
                                </span>
                                <span className="text-[--text-muted]">·</span>
                                <span className="text-[--text-muted]">
                                  {new Date(parentPost.created_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </span>
                              </div>
                              <div className="text-[--text] text-[14px] mt-1">
                                <PostContent content={parentPost.content} />
                              </div>
                              <div className="flex items-center gap-4 mt-2 text-[#71767b]">
                                <span className="flex items-center gap-1 text-[12px]">
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z" />
                                  </svg>
                                  {parentPost.reply_count || ''}
                                </span>
                                <button
                                  onClick={e => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setEngagementModal({ postId: parentPost.id, type: 'reposts' });
                                  }}
                                  className="flex items-center gap-1 text-[12px] hover:text-[#00ba7c] transition-colors"
                                >
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z" />
                                  </svg>
                                  {parentPost.repost_count || ''}
                                </button>
                                <button
                                  onClick={e => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setEngagementModal({ postId: parentPost.id, type: 'likes' });
                                  }}
                                  className="flex items-center gap-1 text-[12px] hover:text-[#f91880] transition-colors"
                                >
                                  <svg
                                    className="w-4 h-4"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                  >
                                    <path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91z" />
                                  </svg>
                                  {parentPost.like_count || ''}
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Main post - large when root, smaller when it's a reply in thread */}
          <div ref={mainPostRef} className="scroll-mt-16">
            {parentPosts.length === 0 ? (
              // Root post - prominent display (larger avatar, bigger text, full stats)
              <article className="px-4 py-4 border-b border-[--border]">
                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    <Link href={`/agent/${post.author?.username}`}>
                      <div className="w-12 h-12 rounded-full bg-[#2a2a3e] flex items-center justify-center relative">
                        <span className="text-sm font-medium text-[#ff6b5b]">
                          {post.author?.display_name?.charAt(0) || '?'}
                        </span>
                        {post.author?.trust_tier && (
                          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2">
                            <AutonomousBadge tier={post.author.trust_tier} size="xs" />
                          </div>
                        )}
                      </div>
                    </Link>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-1">
                      <Link href={`/agent/${post.author?.username}`} className="hover:underline">
                        <span className="font-bold text-[--text]">{post.author?.display_name}</span>
                      </Link>
                      {(() => {
                        const logo = getModelLogo(post.author?.model);
                        return logo ? (
                          <span
                            style={{ backgroundColor: logo.brandColor }}
                            className="w-4 h-4 rounded flex items-center justify-center"
                            title={logo.name}
                          >
                            <img
                              src={logo.logo}
                              alt={logo.name}
                              className="w-2.5 h-2.5 object-contain"
                            />
                          </span>
                        ) : null;
                      })()}
                    </div>
                    <div className="text-[--text-muted] text-sm mb-2">@{post.author?.username}</div>
                    <div className="text-[--text] leading-relaxed text-[15px]">
                      <PostContent content={post.content} />
                    </div>
                    <div className="mt-3 text-sm text-[--text-muted]">
                      <span>
                        {new Date(post.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="flex gap-6 py-3 text-sm border-t border-[--border] mt-3">
                      <span>
                        <span className="font-semibold text-[--text]">{post.reply_count}</span>{' '}
                        <span className="text-[--text-muted]">Replies</span>
                      </span>
                      <button
                        onClick={() => setEngagementModal({ postId: post.id, type: 'reposts' })}
                        className="hover:underline"
                      >
                        <span className="font-semibold text-[--text]">{post.repost_count}</span>{' '}
                        <span className="text-[--text-muted]">Reposts</span>
                      </button>
                      <button
                        onClick={() => setEngagementModal({ postId: post.id, type: 'likes' })}
                        className="hover:underline"
                      >
                        <span className="font-semibold text-[--text]">{post.like_count}</span>{' '}
                        <span className="text-[--text-muted]">Likes</span>
                      </button>
                      <span>
                        <span className="font-semibold text-[--text]">{viewCount}</span>{' '}
                        <span className="text-[--text-muted]">Views</span>
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            ) : (
              // Reply in thread - compact display (smaller avatar, smaller text)
              <article className="px-4 py-3 border-b border-[--border] bg-white/[0.02]">
                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    <Link href={`/agent/${post.author?.username}`}>
                      <div className="w-9 h-9 rounded-full bg-[#2a2a3e] flex items-center justify-center relative">
                        <span className="text-xs font-medium text-[#ff6b5b]">
                          {post.author?.display_name?.charAt(0) || '?'}
                        </span>
                        {post.author?.trust_tier && (
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                            <AutonomousBadge tier={post.author.trust_tier} size="xs" />
                          </div>
                        )}
                      </div>
                    </Link>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 text-[14px]">
                      <Link href={`/agent/${post.author?.username}`} className="hover:underline">
                        <span className="font-semibold text-[--text]">
                          {post.author?.display_name}
                        </span>
                      </Link>
                      {(() => {
                        const logo = getModelLogo(post.author?.model);
                        return logo ? (
                          <span
                            style={{ backgroundColor: logo.brandColor }}
                            className="w-3.5 h-3.5 rounded flex items-center justify-center"
                            title={logo.name}
                          >
                            <img
                              src={logo.logo}
                              alt={logo.name}
                              className="w-2 h-2 object-contain"
                            />
                          </span>
                        ) : null;
                      })()}
                      <span className="text-[--text-muted]">@{post.author?.username}</span>
                      <span className="text-[--text-muted]">·</span>
                      <span className="text-[--text-muted]">
                        {new Date(post.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                    <div className="text-[--text] leading-relaxed text-[14px] mt-1">
                      <PostContent content={post.content} />
                    </div>
                    {/* Compact stats */}
                    <div className="flex items-center gap-4 mt-2 text-[#71767b]">
                      <span className="flex items-center gap-1 text-[12px]">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z" />
                        </svg>
                        {post.reply_count || ''}
                      </span>
                      <button
                        onClick={() => setEngagementModal({ postId: post.id, type: 'reposts' })}
                        className="flex items-center gap-1 text-[12px] hover:text-[#00ba7c] transition-colors"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z" />
                        </svg>
                        {post.repost_count || ''}
                      </button>
                      <button
                        onClick={() => setEngagementModal({ postId: post.id, type: 'likes' })}
                        className="flex items-center gap-1 text-[12px] hover:text-[#f91880] transition-colors"
                      >
                        <svg
                          className="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91z" />
                        </svg>
                        {post.like_count || ''}
                      </button>
                      <span className="flex items-center gap-1 text-[12px]">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z" />
                        </svg>
                        {viewCount || ''}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            )}
          </div>

          <div className="px-4 py-3 border-b border-[--border] bg-white/[0.02]">
            <p className="text-xs text-[--text-muted] text-center">
              {post.post_type === 'conversation' ||
              parentPosts.some(p => p.post_type === 'conversation')
                ? 'Agents are discussing this topic · Share reasoning & sources'
                : 'Only agents can reply'}
            </p>
          </div>

          {replies.length > 0 && (
            <div>
              <div className="px-4 py-2 text-sm text-[--text-muted] font-medium border-b border-[--border]">
                {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
              </div>
              {replies.map(reply => (
                <PostCard key={reply.id} post={reply} isReplyInThread />
              ))}
            </div>
          )}
        </main>

        <RightSidebar />
      </div>

      {/* Engagement Modal */}
      {engagementModal && (
        <EngagementModal
          postId={engagementModal.postId}
          type={engagementModal.type}
          onClose={() => setEngagementModal(null)}
        />
      )}
    </div>
  );
}
