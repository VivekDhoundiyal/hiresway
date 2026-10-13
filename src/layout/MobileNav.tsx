import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { mainNavItems, bottomNavItems } from '@/navigation';
import { Drawer } from '@/components/drawer';

export interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ isOpen, onClose }) => {
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      placement="left"
      width="max-w-xs w-full"
      className="md:hidden"
    >
      <div className="-mt-10 flex flex-col h-full justify-between">
        {/* Brand Header */}
        <div className="h-16 px-4 -mx-5 -mt-4 mb-3 flex items-center border-b border-border shrink-0">
          <Link
            to="/dashboard"
            onClick={onClose}
            className="flex items-center gap-2.5 rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center text-white font-bold text-base shadow-sm">
              C
            </div>
            <span className="text-body-lg font-bold text-text-primary tracking-tight">
              CareerOs
            </span>
          </Link>
        </div>

        {/* Scrollable Navigation Links */}
        <nav className="flex-1 overflow-y-auto space-y-1 pr-1">
          <div className="px-2 pb-2">
            <span className="text-caption font-semibold uppercase text-text-muted tracking-wider">
              Workspace
            </span>
          </div>

          {mainNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.id}
                to={item.path}
                end={item.path === '/dashboard'}
                onClick={onClose}
                className={({ isActive }) => `
                  flex items-center gap-3 px-3 py-2.5 rounded-md text-body-md transition-colors duration-fast
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                  ${
                    isActive
                      ? 'bg-primary-soft text-primary font-medium border-l-2 border-primary'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-subtle font-normal'
                  }
                `}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.title}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="pt-3 -mx-5 px-5 border-t border-border shrink-0 space-y-1 bg-surface mt-4">
          <div className="px-2 pb-1">
            <span className="text-caption font-semibold uppercase text-text-muted tracking-wider">
              Account & System
            </span>
          </div>

          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.id}
                to={item.path}
                end
                onClick={onClose}
                className={({ isActive }) => `
                  flex items-center gap-3 px-3 py-2.5 rounded-md text-body-md transition-colors duration-fast
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                  ${
                    isActive
                      ? 'bg-primary-soft text-primary font-medium border-l-2 border-primary'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-subtle font-normal'
                  }
                `}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.title}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </Drawer>
  );
};
