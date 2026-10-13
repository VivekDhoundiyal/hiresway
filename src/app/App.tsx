import React from 'react';
import { AppRouter } from '@/router';
import { ProfileProvider } from '@/core/profile';
import { RootErrorBoundary } from './RootErrorBoundary';

export const App: React.FC = () => {
  return (
    <RootErrorBoundary>
      <ProfileProvider>
        <AppRouter />
      </ProfileProvider>
    </RootErrorBoundary>
  );
};
