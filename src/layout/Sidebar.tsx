import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { mainNavItems, bottomNavItems } from '@/navigation';
import { useSidebar } from './useSidebar';
import { PanelLeftClose, PanelLeftOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { Tooltip } from '@/components/tooltip';
import { HiresWayLogo } from '@/components/HiresWayLogo';

export interface SidebarProps {
  className?: string;
  onItemClick?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ className = '', onItemClick }) => {
  const { isCollapsed, toggleCollapsed } = useSidebar();
  const [isCopilotCollapsed, setIsCopilotCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem('careeros_copilot_collapsed');
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggleCopilot = () => {
    setIsCopilotCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('careeros_copilot_collapsed', String(next));
      } catch {
        // ignore localStorage errors
      }
      return next;
    });
  };

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
          h-14 border-b border-border/80 shrink-0 flex items-center
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
      <nav className="flex-1 overflow-y-auto px-2.5 py-2 space-y-0.5">
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const navItem = (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.path === '/dashboard'}
              onClick={onItemClick}
              className={({ isActive }) => `
                flex items-center rounded-lg text-xs transition-all duration-fast
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                ${isCollapsed ? 'justify-center h-8 w-full px-0' : 'gap-2 px-2.5 py-1.5'}
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

      {/* Bottom Navigation Section & Collapsible Career Intelligence Card */}
      <div className="p-2 border-t border-border/80 shrink-0 space-y-1 bg-surface">
        {!isCollapsed && (
          <div className="px-2.5 pb-0.5">
            <span className="text-[9.5px] font-bold uppercase text-slate-400 tracking-wider">
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
                flex items-center rounded-lg text-xs transition-all duration-fast
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                ${isCollapsed ? 'justify-center h-8 w-full px-0' : 'gap-2 px-2.5 py-1.5'}
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

        {/* Collapsible Career Intelligence Card */}
        {!isCollapsed && (
          <div className="mt-1 p-2 rounded-lg bg-slate-50 border border-slate-200/70 shadow-3xs relative overflow-hidden transition-all">
            <button
              type="button"
              onClick={toggleCopilot}
              className="w-full flex items-center justify-between text-left cursor-pointer group"
              title={isCopilotCollapsed ? 'Expand Career Intelligence' : 'Collapse Career Intelligence'}
            >
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="text-[11px] font-semibold text-slate-800">Career Intelligence</span>
                <span className="text-[9.5px] text-emerald-600 font-medium bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200/50">Active</span>
              </div>
              <div className="text-slate-400 group-hover:text-slate-600 transition-colors">
                {isCopilotCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
              </div>
            </button>

            {!isCopilotCollapsed && (
              <div className="mt-1.5 pt-1.5 border-t border-slate-200/60 text-[10.5px] text-slate-500">
                <p>Personalized intelligence matching active opportunities against your canonical career profile.</p>
              </div>
            )}
          </div>
        )}

        {/* Collapsed Expand Toggle Button */}
        {isCollapsed && (
          <Tooltip content="Expand sidebar" position="right" className="w-full">
            <button
              type="button"
              onClick={toggleCollapsed}
              className="flex items-center justify-center h-9 w-full rounded-md text-text-muted hover:text-text-primary hover:bg-surface-subtle transition-colors cursor-pointer mt-1"
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
