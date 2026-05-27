"use client";

import React, { useState, useEffect } from 'react';
import {
  Key,
  Copy,
  Shield,
  Eye,
  EyeOff,
  CheckCircle2,
  Loader2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { API_URL, apiFetch } from '@/lib/api';

export default function ApiKeysPage() {
  const { userEmail, logout } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<{ [key: string]: boolean }>({ merchant_id: true });
  const [isRegenerating, setIsRegenerating] = useState(false);

  const fetchProfile = async () => {
    if (!userEmail) return;
    setIsLoading(true);
    setConnectionError(false);
    try {
      const res = await apiFetch(`/merchant/profile`);
      if (res.status === 401 || res.status === 403) {
        console.warn("Unauthorized access to merchant API keys profile. Status:", res.status);
        logout();
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch profile');
      const data = await res.json();
      setProfile(data);
    } catch (err) {
      console.error("Profile fetch error:", err);
      setConnectionError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [userEmail]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const toggleVisibility = (key: string) => {
    setVisibleKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Key copied to clipboard!");
    } catch {
      showToast("Failed to copy key.");
    }
  };

  const handleRegenerateKeys = async () => {
    if (!userEmail) return;
    if (!confirm("Are you sure? Regenerating keys will immediately invalidate your old keys and might break your existing integrations.")) return;

    setIsRegenerating(true);
    try {
      const res = await apiFetch(`/merchant/regenerate-keys`, {
        method: 'POST',
        body: JSON.stringify({ email: userEmail })
      });
      if (!res.ok) throw new Error('Failed to regenerate keys');
      const data = await res.json();
      setProfile((prev: any) => ({ ...prev, merchant_key: data.merchant_key, salt_key: data.salt_key }));
      showToast("API Keys regenerated successfully!");
    } catch (err) {
      alert("Failed to regenerate keys. Please try again.");
    } finally {
      setIsRegenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-muted">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm font-medium">Loading your API keys...</p>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-2">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <div>
          <p className="text-sm font-bold text-secondary">Connection Failed</p>
          <p className="text-xs text-muted max-w-[280px] mt-1">We couldn't reach the server to load your keys.</p>
        </div>
        <button
          onClick={fetchProfile}
          className="px-6 py-2 bg-secondary text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all shadow-md"
        >
          Retry
        </button>
      </div>
    );
  }

  const keys = [
    { name: 'Merchant ID', actualKey: profile?.merchant_id || 'Not Generated', id: 'merchant_id' },
    { name: 'Merchant Key', actualKey: profile?.merchant_key || 'Not Generated', id: 'merchant_key' },
    { name: 'Salt Key', actualKey: profile?.salt_key || 'Not Generated', id: 'salt_key' }
  ];

  return (
    <div className="p-8 page-entry relative">
      {toast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 duration-300">
          <div className="bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-white/10">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <span className="text-sm font-bold">{toast}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-secondary tracking-tight">API Keys</h1>
          <p className="text-xs md:text-sm text-muted">Securely manage your platform integration keys.</p>
        </div>
        {/* <button
          onClick={handleRegenerateKeys}
          disabled={isRegenerating}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-border rounded-lg text-xs font-bold text-secondary hover:bg-slate-50 transition-all shadow-sm"
        >
          {isRegenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 text-primary" />}
          Regenerate Keys
        </button> */}
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 md:p-6 mb-8 flex flex-col sm:flex-row items-start gap-4">
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm shrink-0">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-secondary mb-1">Security Recommendation</h4>
          <p className="text-[10px] md:text-xs text-muted leading-relaxed max-w-2xl">
            Never share your secret keys in client-side code or public repositories. Use our sandbox keys for testing before moving to production. We recommend rotating keys every 90 days.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {keys.map((item) => (
          <div key={item.id} className="premium-card p-4 md:p-6 rounded-2xl flex flex-col gap-6 transition-all hover:shadow-lg hover:border-primary/20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Key className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-secondary text-sm md:text-base">{item.name}</h3>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[8px] font-bold bg-green-50 text-green-600 border border-green-100 uppercase tracking-widest">
                      Active
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 border border-border p-2.5 rounded-xl font-mono text-[10px] md:text-xs text-muted group">
                  <span className="flex-1 break-all select-all">
                    {visibleKeys[item.id] ? item.actualKey : '•'.repeat(32)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => copyToClipboard(item.actualKey)}
                      className="p-1.5 hover:text-primary hover:bg-white rounded-md transition-all"
                      title="Copy Key"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => toggleVisibility(item.id)}
                      className="p-1.5 hover:text-primary hover:bg-white rounded-md transition-all"
                      title={visibleKeys[item.id] ? "Hide Key" : "Show Key"}
                    >
                      {visibleKeys[item.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-6 md:gap-8 pt-4 md:pt-0 border-t md:border-t-0 border-border/50">
                <div className="grid grid-cols-2 gap-6 md:flex md:gap-8">
                  <div>
                    <p className="text-[9px] font-bold text-muted uppercase tracking-wider mb-1">Status</p>
                    <p className="font-bold text-green-600 text-[10px] md:text-xs">Healthy</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-muted uppercase tracking-wider mb-1">Integration</p>
                    <p className="font-bold text-secondary text-[10px] md:text-xs">Live</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
