'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2, Hotel, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
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
      router.push('/properties');
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
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
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white">Welcome back</h2>
            <p className="text-slate-400 text-sm mt-1">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Email */}
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

            {/* Password */}
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

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold py-3 text-sm transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* Demo credentials hint */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-xs text-slate-500 text-center mb-3">Demo credentials</p>
            <div className="bg-white/5 rounded-lg px-4 py-3 space-y-1">
              <p className="text-xs text-slate-400">
                <span className="text-slate-500">Email:</span>{' '}
                <button
                  onClick={() => setEmail('admin@lodgecore.com')}
                  className="text-blue-400 hover:text-blue-300 font-mono transition-colors"
                >
                  admin@lodgecore.com
                </button>
              </p>
              <p className="text-xs text-slate-400">
                <span className="text-slate-500">Password:</span>{' '}
                <button
                  onClick={() => setPassword('password')}
                  className="text-blue-400 hover:text-blue-300 font-mono transition-colors"
                >
                  password
                </button>
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          © {new Date().getFullYear()} LodgeCore PMS · All rights reserved
        </p>
      </div>
    </div>
  );
}
