import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { mainNavItems, bottomNavItems } from '@/navigation';
import { useSidebar } from './useSidebar';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Tooltip } from '@/components/tooltip';
import { HiresWayLogo } from '@/components/HiresWayLogo';

export interface SidebarProps {
  className?: string;
  onItemClick?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ className = '', onItemClick }) => {
  const { isCollapsed, toggleCollapsed } = useSidebar();

  return (
    <aside
      className={`
        ${isCollapsed ? 'w-16' : 'w-64'} h-screen bg-surface border-r border-border flex flex-col justify-between select-none
        transition-[width] duration-normal ease-in-out
        ${className}
      `}
      aria-label="Main Navigation"
    >
      {/* Brand Header */}
      <div
        className={`
          h-16 border-b border-border/80 shrink-0 flex items-center
          ${isCollapsed ? 'justify-center px-2' : 'justify-between px-4'}
        `}
      >
        <Link
          to="/dashboard"
          onClick={onItemClick}
          className="flex items-center gap-2.5 rounded-lg p-1 hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          title="HiresWay Dashboard"
        >
          <HiresWayLogo iconOnly={isCollapsed} size="md" />
        </Link>

        {!isCollapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-subtle transition-colors cursor-pointer"
            title="Collapse sidebar (maximize workspace)"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Main Navigation Items (Scrollable) */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const navItem = (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.path === '/dashboard'}
              onClick={onItemClick}
              className={({ isActive }) => `
                flex items-center rounded-xl text-body-sm transition-all duration-fast
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                ${isCollapsed ? 'justify-center h-10 w-full px-0' : 'gap-3 px-3.5 py-2.5'}
                ${
                  isActive
                    ? 'bg-blue-50/90 text-blue-600 font-semibold border border-blue-200/60 shadow-3xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 font-medium'
                }
              `}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {!isCollapsed && <span className="truncate">{item.title}</span>}
            </NavLink>
          );

          if (isCollapsed) {
            return (
              <Tooltip
                key={item.id}
                content={item.title}
                position="right"
                className="w-full"
              >
                {navItem}
              </Tooltip>
            );
          }

          return navItem;
        })}
      </nav>

      {/* Bottom Navigation Section & Career Intelligence Card */}
      <div className="p-3 border-t border-border/80 shrink-0 space-y-2 bg-surface">
        {!isCollapsed && (
          <div className="px-3 pb-1">
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
              ACCOUNT
            </span>
          </div>
        )}

        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const navItem = (
            <NavLink
              key={item.id}
              to={item.path}
              end
              onClick={onItemClick}
              className={({ isActive }) => `
                flex items-center rounded-xl text-body-sm transition-all duration-fast
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                ${isCollapsed ? 'justify-center h-10 w-full px-0' : 'gap-3 px-3.5 py-2'}
                ${
                  isActive
                    ? 'bg-blue-50/90 text-blue-600 font-semibold border border-blue-200/60 shadow-3xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 font-medium'
                }
              `}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {!isCollapsed && <span className="truncate">{item.title}</span>}
            </NavLink>
          );

          if (isCollapsed) {
            return (
              <Tooltip
                key={item.id}
                content={item.title}
                position="right"
                className="w-full"
              >
                {navItem}
              </Tooltip>
            );
          }

          return navItem;
        })}

        {/* Docked Career Intelligence Card matching Reference */}
        {!isCollapsed && (
          <div className="mt-3 p-3.5 rounded-2xl bg-gradient-to-br from-cyan-50/70 via-blue-50/50 to-white border border-blue-100/80 shadow-xs relative overflow-hidden group">
            <div className="relative z-10 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="text-xs font-bold text-slate-900">Career Intelligence</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Your career copilot is active</span>
              </div>
              <p className="text-[11px] text-slate-400 italic pt-0.5">
                &ldquo;Finding the right opportunities for you.&rdquo;
              </p>
            </div>

            {/* Friendly 3D Copilot Mascot & Mini Analytics Graphic */}
            <div className="flex justify-end items-end pt-1 -mb-1 -mr-1">
              <svg width="72" height="48" viewBox="0 0 72 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Mini analytics chart */}
                <rect x="6" y="24" width="6" height="18" rx="2" fill="#93C5FD" opacity="0.8" />
                <rect x="15" y="16" width="6" height="26" rx="2" fill="#60A5FA" opacity="0.9" />
                <rect x="24" y="8" width="6" height="34" rx="2" fill="#3B82F6" />
                <path d="M 6 22 L 15 14 L 24 6" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
                {/* Cute Copilot Robot Head */}
                <circle cx="50" cy="22" r="16" fill="white" stroke="#E2E8F0" strokeWidth="1.5" />
                <rect x="42" y="15" width="16" height="9" rx="4.5" fill="#0F172A" />
                <circle cx="46" cy="19.5" r="2" fill="#38BDF8" />
                <circle cx="54" cy="19.5" r="2" fill="#38BDF8" />
                <circle cx="50" cy="5" r="2.5" fill="#10B981" />
                <path d="M 50 6 L 50 8" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M 33 22 C 33 20 34 19 35 19" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
                <path d="M 67 22 C 67 20 66 19 65 19" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        )}

        {/* Collapsed Expand Toggle Button */}
        {isCollapsed && (
          <Tooltip content="Expand sidebar" position="right" className="w-full">
            <button
              type="button"
              onClick={toggleCollapsed}
              className="flex items-center justify-center h-10 w-full rounded-md text-text-muted hover:text-text-primary hover:bg-surface-subtle transition-colors cursor-pointer mt-1"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </Tooltip>
        )}
      </div>
    </aside>
  );
};
