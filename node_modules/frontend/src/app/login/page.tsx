'use client';

import React, { useState } from 'react';
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  ChevronLeft,
  AlertCircle,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from "../../components/AuthProvider";

import { API_URL, apiFetch } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoggedIn, userEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      console.log(`Attempting login at: ${API_URL}/login`);

      const res = await apiFetch('/login/merchant', {
        method: 'POST',
        body: JSON.stringify({ 
          email, 
          password,
          required_role: 'merchant'
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Server error response:', errorText);
        throw new Error(`Server responded with ${res.status}: ${errorText.slice(0, 100)}`);
      }

      const data = await res.json();
      console.log('Login response:', data);

      if (data.status === 'success') {
        login(email, data.session_token, data.role);
      } else {
        setError(data.message || 'Incorrect email or password. Please try again.');
        setIsLoading(false);
      }
    } catch (err: unknown) {
      console.error('Login error details:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';

      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Request timed out. The backend is not responding. Please wait and try again.');
      } else if (errorMessage.toLowerCase().includes('fetch') || errorMessage.toLowerCase().includes('network')) {
        setError('Backend is not reachable. It may be starting up — please wait a moment and try again.');
      } else {
        setError(`Error: ${errorMessage}`);
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4 md:p-8 relative">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/5 rounded-full blur-[120px] animate-pulse delay-700" />

      <Link href="/" className="absolute top-4 left-4 md:top-10 md:left-10 flex items-center gap-2 text-muted hover:text-secondary transition-all group z-20">
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white border border-border flex items-center justify-center shadow-sm group-hover:border-primary/30 group-hover:shadow-md transition-all">
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        </div>
        <span className="text-xs md:text-sm font-bold tracking-wide hidden sm:block">Back to Home</span>
      </Link>

      <div className="max-w-md w-full relative z-10 page-entry mt-12 md:mt-0">
        <div className="text-center mb-8 md:mb-10">
          <div className="w-12 h-12 md:w-14 md:h-14 bg-secondary text-white rounded-xl md:rounded-2xl flex items-center justify-center font-black text-xl md:text-2xl mx-auto mb-4 md:mb-6 shadow-2xl shadow-slate-200 border-2 border-white/20 animate-float-slow">P</div>
          <h1 className="text-2xl md:text-4xl font-black text-secondary tracking-tight leading-tight">
            Welcome <span className="text-primary">Back</span>
          </h1>
          <p className="text-xs md:text-sm text-muted mt-3 font-medium px-4">Secure access to your PayFlow merchant dashboard and real-time transaction data.</p>
        </div>

        <div className="premium-card p-6 md:p-10 rounded-[2.5rem] bg-white/80 backdrop-blur-xl shadow-2xl shadow-slate-200/60 border border-white relative group overflow-hidden">
          {/* Subtle glow effect on the card */}
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 to-blue-400/10 rounded-[2.6rem] blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
              <p className="text-[11px] md:text-xs font-bold leading-relaxed">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6 relative">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted uppercase tracking-[0.15em] ml-1">Username or Email</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-muted group-focus-within:text-primary transition-colors">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="HKLLP"
                  className="w-full pl-12 pr-4 py-3.5 md:py-4 bg-slate-50/50 border border-border rounded-2xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/50 focus:bg-white transition-all placeholder:text-slate-300"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[10px] font-black text-muted uppercase tracking-[0.15em]">Password</label>
                <Link href="#" className="text-[10px] font-black text-primary hover:text-blue-700 transition-colors uppercase tracking-widest">Forgot?</Link>
              </div>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-muted group-focus-within:text-primary transition-colors">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3.5 md:py-4 bg-slate-50/50 border border-border rounded-2xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/50 focus:bg-white transition-all placeholder:text-slate-300"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-4 md:py-5 bg-secondary text-white rounded-2xl font-black text-sm uppercase tracking-[0.1em] hover:bg-slate-800 transition-all flex items-center justify-center gap-3 group shadow-xl shadow-slate-200/50 hover:shadow-primary/20 active:scale-[0.98] ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verifying...
                  
                </>
              ) : (
                <>
                  Sign In <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-100 flex items-center justify-center gap-4 text-[10px] font-black text-muted uppercase tracking-[0.2em]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              2FA Protected
            </div>
            <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              SSL Secure
            </div>
          </div>
        </div>

        <p className="text-center text-sm font-medium text-muted mt-10">
          Don&apos;t have an account? <Link href="/contact" className="text-primary font-black hover:underline underline-offset-4 ml-1">Contact Sales</Link>
        </p>
      </div>

      <div className="fixed bottom-8 text-[10px] font-bold text-slate-300 uppercase tracking-[0.3em] pointer-events-none hidden md:block">
        PayFlow Terminal v2.4.0 • Enterprise Edition
      </div>
    </div>
  );
}
