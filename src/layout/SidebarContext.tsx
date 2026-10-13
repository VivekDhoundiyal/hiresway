import React, { createContext, useState, useEffect } from 'react';

export interface SidebarContextType {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('careeros_sidebar_collapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('careeros_sidebar_collapsed', String(isCollapsed));
  }, [isCollapsed]);

  const toggleCollapsed = () => setIsCollapsed((prev) => !prev);

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed, toggleCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
};
