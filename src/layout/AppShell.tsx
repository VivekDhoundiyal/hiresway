import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { TopBar } from './TopBar';
import { SidebarProvider } from './SidebarContext';
import { RouteErrorBoundary } from './RouteErrorBoundary';
import { PerformanceDebugModal } from '@/core/perf/PerformanceDebugModal';

// Subtle, clean skeleton matching the SaaS palette
const PageFallback: React.FC = () => (
  <div className="w-full max-w-7xl mx-auto space-y-4 animate-pulse pt-2">
    <div className="h-8 w-48 bg-gray-200/80 rounded-xl" />
    <div className="h-24 w-full bg-gray-100/90 rounded-2xl border border-gray-200/60" />
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
      <div className="h-56 bg-gray-100/80 rounded-2xl border border-gray-200/60" />
      <div className="h-56 bg-gray-100/80 rounded-2xl border border-gray-200/60" />
      <div className="h-56 bg-gray-100/80 rounded-2xl border border-gray-200/60" />
    </div>
  </div>
);

const AppShellContent: React.FC = () => {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // Automatically reset main scroll to top on page change
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [location.pathname]);

  return (
    <div className="h-screen w-screen flex bg-background text-text-primary overflow-hidden font-sans">
      {/* Dev Performance Debug Overlay (Ctrl+Shift+P) */}
      <PerformanceDebugModal />

      {/* Desktop Sidebar (Never squeezed, hidden below md) */}
      <Sidebar className="hidden md:flex shrink-0" />

      {/* Responsive Mobile Navigation Drawer (Off-canvas) */}
      <MobileNav isOpen={isMobileNavOpen} onClose={() => setIsMobileNavOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Clean Top Bar */}
        <TopBar onOpenMobileMenu={() => setIsMobileNavOpen(true)} />

        {/* Dynamic Page Content */}
        <main
          id="main-content"
          ref={mainRef}
          className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 bg-background scroll-smooth"
        >
          <div className="max-w-7xl w-full mx-auto">
            <RouteErrorBoundary>
              <Suspense fallback={<PageFallback />}>
                <Outlet />
              </Suspense>
            </RouteErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
};

export const AppShell: React.FC = () => {
  return (
    <SidebarProvider>
      <AppShellContent />
    </SidebarProvider>
  );
};
