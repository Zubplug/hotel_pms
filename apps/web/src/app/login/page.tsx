'use client';

import React, { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2, Hotel, Eye, EyeOff, User, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

// Compile-time constant — no runtime mismatch
const IS_DESKTOP = process.env.NEXT_PUBLIC_IS_DESKTOP === 'true';

export default function LoginPage() {
  const router = useRouter();
  
  // Web state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Desktop state
  const [activeStaff, setActiveStaff] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  const [pin, setPin] = useState('');
  
  // Shared state
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch active staff if on desktop
  useEffect(() => {
    if (IS_DESKTOP) {
      const fetchStaff = async () => {
        try {
          const { DesktopDataProvider } = await import('@/lib/desktop/DesktopDataProvider');
          const result = await DesktopDataProvider.auth.getActiveStaff();
          if (result && result.success) {
            setActiveStaff(result.data || []);
          } else {
            console.warn('Failed to load active staff', result?.error);
          }
        } catch (err) {
          console.error('Error fetching staff:', err);
        }
      };
      fetchStaff();
    }
  }, []);

  /**
   * Desktop login: authenticates via SQLite LocalStaff DB (OfflinePMSInterop).
   * Verified entirely locally using the Staff PIN.
   */
  async function handleDesktopLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStaff) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const { DesktopDataProvider } = await import('@/lib/desktop/DesktopDataProvider');
      const result = await DesktopDataProvider.auth.login(selectedStaff.Id, pin);

      if (!result || result.error) {
        setError(result?.error || 'Invalid PIN. Please try again.');
        setIsLoading(false);
        setPin('');
        return;
      }

      // Session stored in C# SecureStorage — navigate to hub
      router.replace('/hub');
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred.');
      setIsLoading(false);
      setPin('');
    }
  }

  /**
   * Web login: uses NextAuth credentials provider.
   */
  async function handleWebLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });
    
    if (result?.error) {
      setError('Invalid email or password. Please try again.');
      setIsLoading(false);
    } else {
      router.push('/hub');
      router.refresh();
    }
  }

  // --- UI Renders ---

  const renderDesktopUI = () => {
    if (!selectedStaff) {
      // Step 1: Select Operator
      return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white">Select Operator</h2>
            <p className="text-slate-400 text-sm mt-1">Tap your name to sign in</p>
          </div>
          
          <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-2 pb-2">
            {activeStaff.length === 0 ? (
              <div className="col-span-2 py-8 text-center text-slate-400">
                <p>No active staff found.</p>
                <p className="text-xs mt-1">Please ensure the device is provisioned and synced.</p>
              </div>
            ) : (
              activeStaff.map((staff) => (
                <button
                  key={staff.Id}
                  onClick={() => {
                    setSelectedStaff(staff);
                    setError('');
                  }}
                  className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all group"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center mb-3 group-hover:bg-blue-600 transition-colors">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-sm font-medium text-white text-center">
                    {staff.FirstName} {staff.LastName}
                  </span>
                  <span className="text-xs text-slate-400 mt-1">
                    {staff.Role.replace('_', ' ')}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      );
    }

    // Step 2: Enter PIN
    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-200">
        <div className="flex items-center gap-3 mb-6">
          <button 
            onClick={() => {
              setSelectedStaff(null);
              setPin('');
              setError('');
            }}
            className="p-2 -ml-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-semibold text-white">
              {selectedStaff.FirstName} {selectedStaff.LastName}
            </h2>
            <p className="text-slate-400 text-sm mt-1">Enter your POS PIN</p>
          </div>
        </div>

        <form onSubmit={handleDesktopLogin} className="space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="pin" className="text-sm font-medium text-slate-300">
              POS PIN
            </label>
            <div className="relative">
              <input
                id="pin"
                type={showPassword ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                autoFocus
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="w-full text-center tracking-[1em] text-2xl rounded-xl bg-white/5 border border-white/10 px-4 py-4 pr-12 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || pin.length < 4}
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold py-4 text-sm transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLoading ? 'Authenticating...' : 'Sign in'}
          </button>
        </form>
      </div>
    );
  };

  const renderWebUI = () => (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">Welcome back</h2>
        <p className="text-slate-400 text-sm mt-1">Sign in to your account to continue</p>
      </div>

      <form onSubmit={handleWebLogin} className="space-y-5">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-slate-300">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@lodgecore.com"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium text-slate-300">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 pr-12 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold py-3 text-sm transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          {isLoading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30 mb-4">
            <Hotel className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">LodgeCore PMS</h1>
          <p className="text-slate-400 mt-1.5 text-sm">Hotel Property Management System</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          {IS_DESKTOP ? renderDesktopUI() : renderWebUI()}
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          © {new Date().getFullYear()} LodgeCore PMS · All rights reserved
        </p>
      </div>
    </div>
  );
}
