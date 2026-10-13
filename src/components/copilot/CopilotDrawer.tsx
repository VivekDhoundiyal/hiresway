import React, { useState } from 'react';
import { Drawer } from '@/components/drawer';
import { Button } from '@/components/button';
import { Badge } from '@/components/badge';
import { useProfile } from '@/core/profile';
import { careerCopilotEngine, CopilotMessage } from '@/core/copilot';
import { Sparkles, Send, Bot, User } from 'lucide-react';

export interface CopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CopilotDrawer: React.FC<CopilotDrawerProps> = ({ isOpen, onClose }) => {
  const { profile } = useProfile();
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'init-1',
      sender: 'copilot',
      text: `Hello ${profile.personalInfo.fullName ? profile.personalInfo.fullName.split(' ')[0] : 'there'}! I am your HiresWay Career Copilot. I can query discovered jobs, evaluate match scores, draft customized outreach messages, and prepare STAR interview responses. How can I assist you right now?`,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const quickPrompts = [
    'Search remote jobs',
    'Summarize my application pipeline',
    'Show verified target companies',
  ];

  const handleSend = async (textToSend?: string) => {
    const prompt = (textToSend || inputPrompt).trim();
    if (!prompt || isProcessing) return;

    const userMsg: CopilotMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: prompt,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setIsProcessing(true);

    try {
      const response = await careerCopilotEngine.handleUserPrompt(prompt, profile);
      setMessages((prev) => [...prev, response]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'copilot',
          text: `An error occurred while running tools: ${err.message || 'Unknown error'}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      placement="right"
      title="HiresWay Career Copilot"
      description="Zero-cost AI assistant powered by local determinism and live engine tools"
      footer={
        <div className="w-full space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Ask Copilot or search opportunities..."
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              className="flex-1 h-9 rounded-md bg-surface border border-border px-3 text-body-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSend()}
              disabled={!inputPrompt.trim() || isProcessing}
              leftIcon={<Send className="h-3.5 w-3.5" />}
            >
              Send
            </Button>
          </div>
          <div className="flex items-center justify-between text-[11px] text-text-muted">
            <span>Powered by HiresWay Local Engines</span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 py-2">
        {/* Quick prompt suggestions */}
        <div className="flex flex-wrap gap-1.5 pb-2 border-b border-border/60">
          {quickPrompts.map((q) => (
            <button
              key={q}
              onClick={() => handleSend(q)}
              className="px-2.5 py-1 rounded-full bg-surface-subtle border border-border text-caption text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors text-left"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Message stream */}
        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col gap-1 p-3 rounded-xl text-body-sm ${
                msg.sender === 'user'
                  ? 'bg-primary-soft text-primary font-medium ml-6'
                  : 'bg-surface border border-border mr-2'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] opacity-70">
                <span className="flex items-center gap-1 font-semibold uppercase tracking-wider">
                  {msg.sender === 'user' ? (
                    <>
                      <User className="h-3 w-3" /> You
                    </>
                  ) : (
                    <>
                      <Bot className="h-3 w-3 text-primary" /> Career Copilot
                    </>
                  )}
                </span>
                <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>

              {/* Tool Execution Details */}
              {msg.toolCall?.result && (
                <div className="mt-2 pt-2 border-t border-border/60 space-y-2">
                  <Badge variant="neutral" size="sm">
                    Tool Result: {msg.toolCall.toolName}
                  </Badge>
                  {msg.toolCall.result.jobs && (
                    <div className="space-y-1.5">
                      {msg.toolCall.result.jobs.map((j: any) => (
                        <div
                          key={j.id}
                          className="p-2 rounded bg-surface-subtle border border-border/70 flex items-center justify-between text-caption"
                        >
                          <div>
                            <span className="font-semibold text-text-primary block">{j.title}</span>
                            <span className="text-text-muted">{j.company} • {j.location}</span>
                          </div>
                          {j.matchScore && (
                            <Badge variant="primary" size="sm">
                              {j.matchScore}%
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.toolCall.result.companies && (
                    <div className="space-y-1.5">
                      {msg.toolCall.result.companies.map((c: any) => (
                        <div
                          key={c.id}
                          className="p-2 rounded bg-surface-subtle border border-border/70 flex items-center justify-between text-caption"
                        >
                          <div>
                            <span className="font-semibold text-text-primary block">{c.name}</span>
                            <span className="text-text-muted">{c.domain || 'Domain verified'}</span>
                          </div>
                          <Badge variant={c.verified ? 'primary' : 'neutral'} size="sm">
                            {c.atsType || 'Direct'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.toolCall.result.activeCount !== undefined && (
                    <div className="grid grid-cols-3 gap-2 text-center pt-1">
                      <div className="p-2 rounded bg-surface-subtle border border-border">
                        <span className="block text-body-sm font-bold text-text-primary">
                          {msg.toolCall.result.activeCount}
                        </span>
                        <span className="text-[10px] text-text-muted">Active Roles</span>
                      </div>
                      <div className="p-2 rounded bg-surface-subtle border border-border">
                        <span className="block text-body-sm font-bold text-text-primary">
                          {msg.toolCall.result.interviewingCount}
                        </span>
                        <span className="text-[10px] text-text-muted">Interviewing</span>
                      </div>
                      <div className="p-2 rounded bg-surface-subtle border border-border">
                        <span className="block text-body-sm font-bold text-text-primary">
                          {msg.toolCall.result.offerCount}
                        </span>
                        <span className="text-[10px] text-text-muted">Offers</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {isProcessing && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-surface border border-border text-caption text-text-muted">
              <Sparkles className="h-4 w-4 animate-spin text-primary" />
              <span>Analyzing job data and orchestrating tools...</span>
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
};
