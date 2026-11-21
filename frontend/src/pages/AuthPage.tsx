import React, { useState } from 'react';
import { Logo } from '../components/Logo';
import { Mail, Lock, User, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';

interface AuthPageProps {
  initialMode?: 'login' | 'signup' | 'reset-password';
  onSuccess?: () => void;
  onNavigateHome?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = 'login',
  onSuccess,
  onNavigateHome,
}) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset-password'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (mode === 'reset-password') {
      setTimeout(() => {
        // demo reset confirmation
      }, 500);
    } else {
      setTimeout(() => {
        if (onSuccess) onSuccess();
        else if (onNavigateHome) onNavigateHome();
      }, 800);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800/90 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl relative">
        {/* Primary logo centered above form, ~200px wide */}
        <div className="flex justify-center mb-8">
          <Logo
            variant="primary"
            width={200}
            alt="Ferret-Unbury"
            href="/"
            className="hover:opacity-95 transition-opacity"
          />
        </div>

        {/* Form Title & Subtitle */}
        <div className="text-center mb-6">
          <h2 className="text-lg font-bold text-slate-100 tracking-tight">
            {mode === 'login' && 'Welcome back to Ferret-Unbury'}
            {mode === 'signup' && 'Create your Ferret-Unbury account'}
            {mode === 'reset-password' && 'Reset your password'}
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            {mode === 'login' && 'Enter your credentials to access your local-first library'}
            {mode === 'signup' && 'Start organizing and discovering documents with semantic AI'}
            {mode === 'reset-password' && 'Enter your email to receive recovery instructions'}
          </p>
        </div>

        {submitted && mode === 'reset-password' ? (
          <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center animate-fade-in">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <h3 className="text-xs font-bold text-emerald-200">Password Reset Email Dispatched</h3>
            <p className="text-[11px] text-slate-300 mt-1">
              If an account matches <strong>{email}</strong>, you will receive instructions shortly.
            </p>
            <button
              onClick={() => {
                setSubmitted(false);
                setMode('login');
              }}
              className="mt-4 text-xs text-emerald-400 hover:text-emerald-300 font-semibold underline"
            >
              Back to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {mode !== 'reset-password' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-300">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => setMode('reset-password')}
                      className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full mt-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
            >
              <span>
                {mode === 'login' && 'Sign In'}
                {mode === 'signup' && 'Create Account'}
                {mode === 'reset-password' && 'Send Recovery Email'}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

        {/* Tab switchers */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 text-center text-xs text-slate-400">
          {mode === 'login' ? (
            <p>
              Don't have an account?{' '}
              <button
                onClick={() => setMode('signup')}
                className="text-blue-400 hover:text-blue-300 font-semibold"
              >
                Sign up
              </button>
            </p>
          ) : (
            <p>
              Already registered?{' '}
              <button
                onClick={() => setMode('login')}
                className="text-blue-400 hover:text-blue-300 font-semibold"
              >
                Sign in
              </button>
            </p>
          )}
        </div>

        {/* Privacy badge */}
        <div className="mt-5 flex items-center justify-center gap-1.5 text-[10px] text-slate-500 font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Local-First End-to-End Encryption</span>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
