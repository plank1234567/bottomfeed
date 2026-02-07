'use client';

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar, { type Stats } from './Sidebar';
import RightSidebar from './RightSidebar';
import MobileHeader from './MobileHeader';
import MobileBottomNav from './MobileBottomNav';
import OfflineBanner from './OfflineBanner';

interface AppShellProps {
  children: ReactNode;
  stats?: Stats;
}

export default function AppShell({ children, stats }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerOffset, setDrawerOffset] = useState(0);
  const pathname = usePathname();
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const swiping = useRef(false);
  const drawerTriggerRef = useRef<HTMLElement | null>(null);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Close drawer on Escape, lock body scroll, focus restoration
  useEffect(() => {
    if (!drawerOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
      // Restore focus to the element that triggered the drawer
      drawerTriggerRef.current?.focus();
    };
  }, [drawerOpen]);

  const toggleDrawer = useCallback(() => {
    setDrawerOpen(prev => {
      if (!prev) {
        // Opening — save trigger element for focus restoration
        drawerTriggerRef.current = document.activeElement as HTMLElement;
      }
      return !prev;
    });
  }, []);

  // Swipe-to-close handlers for the drawer
  const onDrawerTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    swiping.current = false;
  }, []);

  const onDrawerTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = Math.abs(touch.clientY - touchStartY.current);

    // Only activate horizontal swipe (left), not vertical scroll
    if (!swiping.current && Math.abs(deltaX) > 10 && Math.abs(deltaX) > deltaY) {
      swiping.current = true;
    }

    if (swiping.current && deltaX < 0) {
      setDrawerOffset(deltaX);
    }
  }, []);

  const onDrawerTouchEnd = useCallback(() => {
    if (swiping.current && drawerOffset < -80) {
      setDrawerOpen(false);
    }
    setDrawerOffset(0);
    swiping.current = false;
  }, [drawerOffset]);

  // Reset offset when drawer closes
  useEffect(() => {
    if (!drawerOpen) setDrawerOffset(0);
  }, [drawerOpen]);

  const drawerTransform = drawerOpen
    ? drawerOffset < 0
      ? `translateX(${drawerOffset}px)`
      : 'translateX(0)'
    : 'translateX(-100%)';

  return (
    <div className="min-h-screen relative z-10">
      <OfflineBanner />

      {/* Mobile header - visible below md */}
      <MobileHeader onMenuClick={toggleDrawer} />

      {/* Mobile bottom nav - visible below md */}
      <MobileBottomNav />

      {/* Mobile drawer backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
          style={{
            opacity: drawerOffset < 0 ? Math.max(0, 1 + drawerOffset / 275) : 1,
          }}
        />
      )}

      {/* Mobile drawer with Sidebar — swipeable */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-[275px] md:hidden ${
          swiping.current ? '' : 'transition-transform duration-200 ease-out'
        }`}
        style={{ transform: drawerTransform }}
        role="dialog"
        aria-modal={drawerOpen}
        aria-label="Navigation menu"
        onTouchStart={onDrawerTouchStart}
        onTouchMove={onDrawerTouchMove}
        onTouchEnd={onDrawerTouchEnd}
      >
        <div className="h-full bg-[--bg] overflow-y-auto">
          <Sidebar stats={stats} />
        </div>
      </div>

      {/* Desktop sidebar - hidden below md */}
      <div className="hidden md:block">
        <Sidebar stats={stats} />
      </div>

      {/* Main content area */}
      <div className="pt-12 pb-14 md:pt-0 md:pb-0 md:ml-[275px] lg:flex">
        <main
          id="main-content"
          className="flex-1 min-w-0 min-h-screen border-x border-white/5"
          role="main"
        >
          {children}
        </main>

        {/* Right sidebar - hidden below lg */}
        <div className="hidden lg:block">
          <RightSidebar />
        </div>
      </div>
    </div>
  );
}
