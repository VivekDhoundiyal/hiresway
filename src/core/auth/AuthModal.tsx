import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/modal';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { authEngine, PublicAccountInfo, UserSession } from './authEngine';
import { userContextService } from './userContext';
import { ShieldCheck, UserPlus, LogIn, Users, AlertCircle, CheckCircle2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register' | 'switch';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
}) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register' | 'switch'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<PublicAccountInfo[]>([]);
  const [currentSession, setCurrentSession] = useState<UserSession>(userContextService.getSession());

  useEffect(() => {
    setMode(initialMode);
    setError(null);
  }, [initialMode, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setAccounts(authEngine.getRegisteredAccounts());
      setCurrentSession(userContextService.getSession());
    }
  }, [isOpen]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await userContextService.login(email.trim(), password);
      if (!res.success) {
        setError(res.error || 'Authentication failed. Please verify credentials.');
      } else {
        onClose();
        // Soft reload to rehydrate per-user stores
        window.location.reload();
      }
    } catch {
      setError('An unexpected cryptographic error occurred during verification.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName || !email || !password) {
      setError('Please complete all registration fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters for local cryptographic security.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await userContextService.register({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
      });
      if (!res.success) {
        setError(res.error || 'Registration failed.');
      } else {
        onClose();
        navigate('/onboarding');
      }
    } catch {
      setError('An unexpected error occurred during account creation.');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchAccount = async (account: PublicAccountInfo) => {
    setLoading(true);
    setError(null);
    try {
      const switched = authEngine.switchAccount(account.id);
      if (switched) {
        onClose();
        window.location.reload();
      } else {
        setError('Could not switch account.');
      }
    } catch {
      setError('Failed to switch active user account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        mode === 'login'
          ? 'Sign In to HiresWay'
          : mode === 'register'
          ? 'Create Your Career Account'
          : 'Switch Career Account'
      }
      description="Zero-cost, privacy-first local cryptographic identity and workspace isolation."
      size="md"
    >
      <div className="space-y-4 pt-1">
        {/* Security / Privacy Pill */}
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>
            Credentials are protected with client-side <strong>PBKDF2-SHA256</strong> hashing and 100,000 iterations.
            Zero cloud server tracking.
          </span>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-3.5">
            <div>
              <label className="block text-caption font-semibold text-text-secondary mb-1">
                Email Address
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="candidate@hiresway.local"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-caption font-semibold text-text-secondary mb-1">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('register');
                }}
                className="text-xs text-primary font-medium hover:underline"
              >
                Need an account? Sign up
              </button>
              <Button type="submit" variant="primary" size="sm" isLoading={loading} leftIcon={<LogIn className="h-4 w-4" />}>
                Sign In
              </Button>
            </div>

            {accounts.length > 0 && (
              <div className="pt-3 border-t border-border flex justify-center">
                <button
                  type="button"
                  onClick={() => setMode('switch')}
                  className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-1.5 font-medium"
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>Switch saved local account ({accounts.length})</span>
                </button>
              </div>
            )}
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div>
              <label className="block text-caption font-semibold text-text-secondary mb-1">
                Full Name
              </label>
              <Input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Alex Morgan"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-caption font-semibold text-text-secondary mb-1">
                Email Address
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex.morgan@domain.com"
                required
              />
            </div>
            <div>
              <label className="block text-caption font-semibold text-text-secondary mb-1">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
              />
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('login');
                }}
                className="text-xs text-primary font-medium hover:underline"
              >
                Already have an account? Sign in
              </button>
              <Button type="submit" variant="primary" size="sm" isLoading={loading} leftIcon={<UserPlus className="h-4 w-4" />}>
                Create Account
              </Button>
            </div>
          </form>
        )}

        {mode === 'switch' && (
          <div className="space-y-3">
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {accounts.map((acc) => {
                const isActive = acc.id === currentSession.id;
                return (
                  <div
                    key={acc.id}
                    onClick={() => !isActive && handleSwitchAccount(acc)}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                      isActive
                        ? 'border-primary bg-primary-soft/30 cursor-default'
                        : 'border-border hover:border-slate-300 hover:bg-surface-subtle'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-body-sm font-semibold text-text-primary">
                          {acc.displayName}
                        </span>
                        {isActive && (
                          <span className="text-[10px] bg-primary text-white px-1.5 py-0.5 rounded-full font-bold">
                            Active
                          </span>
                        )}
                      </div>
                      <span className="text-caption text-text-muted">{acc.email}</span>
                    </div>
                    {isActive ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : (
                      <Button variant="outline" size="sm">
                        Switch
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMode('register')}
                className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Add Another Account</span>
              </button>
              <Button variant="ghost" size="sm" onClick={() => setMode('login')}>
                Back to Sign In
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
