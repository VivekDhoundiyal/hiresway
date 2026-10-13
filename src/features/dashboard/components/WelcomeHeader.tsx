import React from 'react';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Plus } from 'lucide-react';

export interface WelcomeHeaderProps {
  userName?: string;
  onNewAction?: () => void;
}

export const WelcomeHeader: React.FC<WelcomeHeaderProps> = ({
  userName,
  onNewAction,
}) => {
  const greeting = userName ? `Welcome back, ${userName}` : 'Welcome to CareerOs';

  return (
    <PageHeader
      title={greeting}
      description="Track pipeline momentum, manage active conversations, and organize career progress."
      badge={
        <Badge variant="primary" size="sm" dot>
          Search Mode
        </Badge>
      }
      actions={
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={onNewAction}
        >
          Track Application
        </Button>
      }
    />
  );
};
