'use client';

import React, { useState } from 'react';
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  ChevronLeft,
  AlertCircle,
  Loader2,
  Shield,
  Fingerprint,
  Zap
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from "../../../components/AuthProvider";
import { API_URL, apiFetch } from '@/lib/api';

export default function AdminLoginPage() {
  const router = useRouter();
  const { login, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Ensure fresh login by clearing any existing session on mount
  React.useEffect(() => {
    logout(false);
    
    // Add Google Fonts
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;900&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await apiFetch('/login/admin', {
        method: 'POST',
        body: JSON.stringify({ 
          email, 
          password,
          required_role: 'admin'
        }),
      });

      if (!res.ok) {
        throw new Error('Server connection failed');
      }

      const data = await res.json();

      if (data.status === 'success') {
        login(email, data.session_token, data.role);
      } else {
        setError(data.message || 'Access denied. Please check your admin credentials.');
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('Admin Login error details:', err);
      const errorMessage = err.message || 'An unexpected error occurred';
      
      if (errorMessage.toLowerCase().includes('fetch') || errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('connect')) {
        setError(`Backend Terminal is unreachable. Please ensure the backend is running and accessible at ${API_URL}.`);
      } else {
        setError(errorMessage);
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden font-['Outfit']">
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/5 rounded-full blur-[120px] animate-pulse delay-1000" />
        
        {/* Animated Grid lines */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
      </div>

      <Link href="/" className="absolute top-8 left-8 flex items-center gap-3 text-slate-500 hover:text-white transition-all group z-30">
        <div className="w-10 h-10 rounded-xl bg-slate-800/50 backdrop-blur-md border border-slate-700/50 flex items-center justify-center group-hover:border-blue-500/30 transition-all shadow-xl">
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        </div>
        <span className="text-sm font-bold tracking-widest uppercase">Exit Vault</span>
      </Link>

      <div className="max-w-[440px] w-full relative z-10">
        {/* Logo and Header */}
        <div className="text-center mb-10">
          <div className="inline-flex relative mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-900/40 relative z-10 border border-blue-400/30">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <div className="absolute inset-0 bg-blue-500 rounded-2xl blur-2xl opacity-20 animate-pulse" />
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full border-4 border-[#0f172a] flex items-center justify-center z-20">
              <Zap className="w-3 h-3 text-[#0f172a] fill-current" />
            </div>
          </div>
          
          <h1 className="text-4xl font-black text-white tracking-tight mb-3">
            Admin <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Terminal</span>
          </h1>
          <p className="text-slate-400 font-medium text-sm tracking-wide">Secure Access for Gateway Controllers</p>
        </div>

        {/* Glassmorphic Login Card */}
        <div className="bg-slate-900/40 backdrop-blur-3xl p-8 md:p-12 rounded-[2.5rem] border border-white/5 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] relative overflow-hidden group">
          {/* Internal Glow Effect */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-[60px] group-hover:bg-blue-500/20 transition-all duration-700" />
          
          {error && (
            <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 animate-in fade-in slide-in-from-top-4 duration-500">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-xs font-bold leading-relaxed">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8" autoComplete="off">
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Identity Handle</label>
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
              </div>
              <div className="relative group/input">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-slate-800/50 rounded-xl flex items-center justify-center border border-slate-700/50 group-focus-within/input:border-blue-500/50 transition-all">
                  <Fingerprint className="w-5 h-5 text-slate-400 group-focus-within/input:text-blue-400" />
                </div>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Administrator ID"
                  className="w-full pl-16 pr-6 py-5 bg-slate-950/30 border border-white/5 rounded-2xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/40 transition-all font-medium"
                  required
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Access Key</label>
                <Lock className="w-3 h-3 text-blue-500" />
              </div>
              <div className="relative group/input">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-slate-800/50 rounded-xl flex items-center justify-center border border-slate-700/50 group-focus-within/input:border-blue-500/50 transition-all">
                  <Lock className="w-5 h-5 text-slate-400 group-focus-within/input:text-blue-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-16 pr-6 py-5 bg-slate-950/30 border border-white/5 rounded-2xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/40 transition-all font-medium"
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full relative group/btn"
            >
              <div className="absolute inset-0 bg-blue-600 rounded-2xl blur-xl opacity-20 group-hover/btn:opacity-40 transition-all" />
              <div className="relative py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-2xl transition-all active:scale-[0.98] disabled:opacity-50 overflow-hidden">
                {isLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <span>Authenticate</span>
                    <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-2 transition-transform" />
                  </>
                )}
                {/* Shimmer Effect */}
                <div className="absolute top-0 -left-full w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-20deg] group-hover/btn:animate-[shimmer_1.5s_infinite]" />
              </div>
            </button>
          </form>
        </div>

        {/* Footer Security Badge */}
        <div className="mt-10 flex flex-col items-center gap-4">
          <div className="px-6 py-3 bg-emerald-500/5 border border-emerald-500/10 rounded-full flex items-center gap-3 shadow-sm">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <span className="text-[10px] font-black text-emerald-500/80 uppercase tracking-[0.2em]">Secure 256-bit Encrypted Connection Active</span>
          </div>
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.3em]">Next Gateway Core • Authorization Level: Tier 1</p>
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          100% { left: 200%; }
        }
      `}</style>
    </div>
  );
}
