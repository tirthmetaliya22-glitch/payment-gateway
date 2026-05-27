'use client';

import React, { useState, useEffect } from 'react';
import {
  Key,
  ShieldCheck,
  ArrowLeft,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import { API_URL, apiFetch } from '@/lib/api';

export default function SetPasswordPage() {
  const params = useParams();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [inquiry, setInquiry] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchInquiry = async () => {
      try {
        const res = await apiFetch(`/admin/inquiries`);
        const data = await res.json();
        const found = data.find((i: any) => (i.inquiry_id || i.id) === params.id);
        if (found) {
          setInquiry(found);
        }
      } catch (err) {
        console.error("Failed to fetch inquiry:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInquiry();
  }, [params.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (password.length < 12) {
      alert("Password must be at least 12 characters long.");
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await apiFetch(`/admin/activate-merchant`, {
        method: 'POST',
        body: JSON.stringify({
          inquiry_id: params.id,
          password: password
        })
      });

      const data = await res.json();

      if (res.ok && data.status === 'success') {
        setIsSuccess(true);
        setTimeout(() => {
          router.push('/admin/merchants');
        }, 2000);
      } else {
        alert(data.message || "Failed to activate merchant");
      }
    } catch (err) {
      console.error("Error activating merchant:", err);
      alert("An error occurred. Please check if the backend is running.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!inquiry && !isLoading) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-secondary mb-4">Inquiry not found</h2>
        <Link href="/admin/merchants" className="text-primary font-bold hover:underline">Back to Merchants</Link>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-8">
        <div className="premium-card p-12 rounded-3xl text-center max-w-md w-full animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center text-green-500 mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-secondary mb-2">Password Set!</h2>
          <p className="text-muted text-sm mb-8">The merchant account for <b>{inquiry.name}</b> has been activated successfully.</p>
          <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 animate-progress-fast" />
          </div>
          <p className="text-[10px] text-muted mt-4 uppercase tracking-widest font-bold">Redirecting to management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Link href="/admin/merchants" className="flex items-center gap-2 text-muted hover:text-secondary mb-8 group transition-colors">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span className="text-sm font-bold">Back to Merchants</span>
      </Link>

      <div className="premium-card rounded-3xl overflow-hidden border border-border shadow-xl shadow-slate-200 bg-white">
        <div className="p-8 border-b border-border bg-slate-50/50">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-secondary tracking-tight">Set Merchant Password</h1>
              <p className="text-xs text-muted font-mono uppercase tracking-widest">Inquiry ID: {inquiry.id}</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-2 gap-6 mb-10">
            <div className="p-4 bg-slate-50 rounded-xl border border-border">
              <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Merchant Name</p>
              <p className="text-sm font-bold text-secondary">{inquiry.name}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-border">
              <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Email Address</p>
              <p className="text-sm font-bold text-secondary truncate">{inquiry.email}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Initialize Temporary Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 12 characters"
                  className="w-full pl-10 pr-12 py-3 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-secondary"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-muted">The merchant will be required to change this password on their first login.</p>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                className="w-full py-4 bg-primary text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 group shadow-lg shadow-emerald-100"
              >
                Activate Account <ShieldCheck className="w-4 h-4 group-hover:scale-110 transition-transform" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
