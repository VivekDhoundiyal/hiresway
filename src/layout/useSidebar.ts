import { useContext } from 'react';
import { SidebarContext } from './SidebarContext';

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    // Return safe default if rendered outside provider
    return {
      isCollapsed: false,
      setIsCollapsed: () => {},
      toggleCollapsed: () => {},
    };
  }
  return context;
};
