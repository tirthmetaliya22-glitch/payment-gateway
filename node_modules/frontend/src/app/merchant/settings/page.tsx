'use client';

import React, { useState, useEffect } from 'react';
import { 
  User, 
  Building2, 
  Bell, 
  Lock, 
  ChevronRight,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Key,
  Copy,
  LogOut
} from 'lucide-react';
import { useAuth } from "../../../components/AuthProvider";

import { API_URL, apiFetch } from '@/lib/api';

export default function SettingsPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const { logout, userEmail } = useAuth();
  const [profile, setProfile] = useState({ name: '', email: '', merchant_key: '', salt_key: '', user_id: '' });
  const [passwords, setPasswords] = useState({ current: '', next: '' });
  const [showKeys, setShowKeys] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingBusiness, setIsEditingBusiness] = useState(false);
  const [businessInfo, setBusinessInfo] = useState({ 
    name: 'PayFlow Solutions Ltd.', 
    taxId: 'Tax ID: GB-123456789' 
  });

  const handleSaveBusiness = async () => {
    try {
      const res = await apiFetch(`/merchant/profile`, {
        method: 'POST',
        body: JSON.stringify({
          name: profile.name,
          email: profile.email,
          business_name: businessInfo.name,
          tax_id: businessInfo.taxId
        })
      });
      if (res.ok) {
        showFeedback("Business information saved in database successfully!");
        setIsEditingBusiness(false);
      } else {
        showFeedback("Failed to save business info.", "error");
      }
    } catch {
      showFeedback("Network error. Please try again.", "error");
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await apiFetch(`/merchant/profile`);
        if (res.status === 401 || res.status === 403) {
          console.warn("Unauthorized access to merchant profile. Status:", res.status);
          logout();
          return;
        }
        const data = await res.json();
        setProfile({ 
          name: data.name || '', 
          email: data.email || userEmail || '',
          merchant_key: data.merchant_key || '',
          salt_key: data.salt_key || '',
          user_id: data.user_id || ''
        });
        setBusinessInfo({
          name: data.business_name || 'PayFlow Solutions Ltd.',
          taxId: data.tax_id || 'Tax ID: GB-123456789'
        });
      } catch (err) {
        if (err instanceof TypeError && err.message === 'Failed to fetch') {
          console.warn(`Backend connectivity issue: Server at ${API_URL} is unreachable.`);
        } else {
          console.error("Failed to fetch profile:", err);
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [userEmail]);

  const showFeedback = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch(`/merchant/profile`, {
        method: 'POST',
        body: JSON.stringify({
          name: profile.name,
          email: profile.email,
          business_name: businessInfo.name,
          tax_id: businessInfo.taxId
        })
      });
      if (res.ok) {
        showFeedback("Profile information updated successfully!");
      } else {
        showFeedback("Failed to update profile.", "error");
      }
    } catch {
      showFeedback("Network error. Please try again.", "error");
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.next.length < 8) {
      showFeedback("New password must be at least 8 characters long.", 'error');
      return;
    }
    
    try {
      const res = await apiFetch(`/merchant/password`, {
        method: 'POST',
        body: JSON.stringify({
          email: profile.email || userEmail,
          current_password: passwords.current,
          new_password: passwords.next
        })
      });
      if (res.ok) {
        showFeedback("Password updated successfully! Please keep it secure.");
        setPasswords({ current: '', next: '' });
      } else {
        showFeedback("Failed to update password.", "error");
      }
    } catch {
      showFeedback("Network error. Please try again.", "error");
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showFeedback(`${label} copied to clipboard!`);
    } catch {
      showFeedback("Failed to copy.", "error");
    }
  };

  const handleRegenerateKeys = async () => {
    if (!confirm("Regenerating keys will invalidate your current ones. Any existing integrations using these keys will stop working. Continue?")) return;
    
    try {
      const res = await apiFetch(`/merchant/regenerate-keys`, {
        method: 'POST',
        body: JSON.stringify({ email: profile.email || userEmail })
      });
      const data = await res.json();
      if (res.ok) {
        setProfile({
          ...profile,
          merchant_key: data.merchant_key,
          salt_key: data.salt_key
        });
        showFeedback("API Credentials rotated successfully!");
      } else {
        showFeedback("Failed to regenerate keys.", "error");
      }
    } catch {
      showFeedback("Network error. Please try again.", "error");
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto page-entry relative">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 duration-300 w-[90%] max-w-sm">
          <div className={`px-4 md:px-6 py-3 rounded-full shadow-2xl flex items-center justify-center gap-3 border ${
            toast.type === 'success' ? 'bg-slate-900 text-white border-white/10' : 'bg-red-600 text-white border-red-500'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span className="text-xs md:text-sm font-bold text-center">{toast.message}</span>
          </div>
        </div>
      )}

      <div className="mb-8 text-center sm:text-left">
        <h1 className="text-xl md:text-2xl font-bold text-secondary tracking-tight">Settings</h1>
        <p className="text-[10px] md:text-sm text-muted">Manage your profile, business details, and security.</p>
      </div>

      <div className="space-y-6">
        {/* Profile Section */}
        <form onSubmit={handleSaveProfile} className="premium-card rounded-2xl overflow-hidden">
          <div className="p-4 md:p-6 border-b border-border bg-slate-50/30">
            <h3 className="font-bold text-secondary flex items-center gap-2 text-sm md:text-base uppercase tracking-wider">
              <User className="w-4 h-4 text-primary" /> Profile Info
            </h3>
          </div>
          <div className="p-4 md:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] md:text-xs font-bold text-muted uppercase tracking-wider">Full Name</label>
                <input 
                  type="text" 
                  value={profile.name}
                  onChange={(e) => setProfile({...profile, name: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] md:text-xs font-bold text-muted uppercase tracking-wider">Email Address</label>
                <input 
                  type="email" 
                  value={profile.email}
                  onChange={(e) => setProfile({...profile, email: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all" 
                />
              </div>
                  {profile.user_id && (
                    <button 
                      type="button"
                      onClick={() => copyToClipboard(/^[0-9a-fA-F]{24}$/.test(profile.user_id) ? `ObjectId('${profile.user_id}')` : profile.user_id, "User ID")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-secondary"
                      title="Copy User ID"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  )}
                
            </div>
            <button 
              type="submit"
              className="w-full sm:w-auto px-4 py-2 bg-primary text-white rounded-md text-xs font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
            >
              Save Changes
            </button>
          </div>
        </form>

        {/* Security Section */}
        <form onSubmit={handleUpdatePassword} className="premium-card rounded-2xl overflow-hidden">
          <div className="p-4 md:p-6 border-b border-border bg-slate-50/30">
            <h3 className="font-bold text-secondary flex items-center gap-2 text-sm md:text-base uppercase tracking-wider">
              <Lock className="w-4 h-4 text-primary" /> Security
            </h3>
          </div>
          <div className="p-4 md:p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] md:text-xs font-bold text-muted uppercase tracking-wider">Current Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required
                    value={passwords.current}
                    onChange={(e) => setPasswords({...passwords, current: e.target.value})}
                    placeholder="••••••••" 
                    className="w-full px-3 py-2 bg-slate-50 border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all" 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-secondary"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] md:text-xs font-bold text-muted uppercase tracking-wider">New Password</label>
                <input 
                  type={showPassword ? "text" : "password"} 
                  required
                  value={passwords.next}
                  onChange={(e) => setPasswords({...passwords, next: e.target.value})}
                  placeholder="New Secure Password" 
                  className="w-full px-3 py-2 bg-slate-50 border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all" 
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-[10px] text-muted italic text-center sm:text-left">Password must be at least 8 characters long with symbols.</p>
              <button 
                type="submit"
                className="w-full sm:w-auto px-6 py-2 bg-secondary text-white rounded-md text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm"
              >
                Update Password
              </button>
            </div>
          </div>
        </form>

        {/* Business Section */}
        <div className="premium-card rounded-2xl overflow-hidden">
          <div className="p-4 md:p-6 border-b border-border bg-slate-50/30">
            <h3 className="font-bold text-secondary flex items-center gap-2 text-sm md:text-base uppercase tracking-wider">
              <Building2 className="w-4 h-4 text-primary" /> Business
            </h3>
          </div>
          <div className="p-4 md:p-6 space-y-4">
            {isEditingBusiness ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Business Name</label>
                    <input 
                      type="text" 
                      value={businessInfo.name}
                      onChange={(e) => setBusinessInfo({...businessInfo, name: e.target.value})}
                      className="w-full px-3 py-2 bg-white border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Tax ID / GSTIN</label>
                    <input 
                      type="text" 
                      value={businessInfo.taxId}
                      onChange={(e) => setBusinessInfo({...businessInfo, taxId: e.target.value})}
                      className="w-full px-3 py-2 bg-white border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all" 
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handleSaveBusiness}
                    className="flex-1 sm:flex-none px-4 py-1.5 bg-primary text-white rounded-md text-[10px] font-bold hover:bg-blue-700 transition-colors"
                  >
                    Save Details
                  </button>
                  <button 
                    onClick={() => setIsEditingBusiness(false)}
                    className="flex-1 sm:flex-none px-4 py-1.5 bg-slate-100 text-secondary rounded-md text-[10px] font-bold hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-slate-50 rounded-lg border border-border group hover:bg-white hover:shadow-sm transition-all duration-300 gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="w-10 h-10 bg-white rounded-md border border-border flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-secondary truncate">{businessInfo.name}</p>
                    <p className="text-[10px] text-muted font-mono truncate">{businessInfo.taxId}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsEditingBusiness(true)}
                  className="w-full sm:w-auto px-3 py-1 text-[10px] font-bold text-primary border border-primary/20 rounded-full hover:bg-primary hover:text-white transition-all"
                >
                  Edit Business
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button className="premium-card p-4 rounded-xl flex items-center justify-between hover:bg-slate-50 transition-colors group text-left w-full">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-primary shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <span className="text-sm font-bold text-secondary">Notification Preferences</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted group-hover:translate-x-1 transition-transform shrink-0" />
          </button>
          
          <div className="premium-card p-4 rounded-xl border-dashed border flex items-center justify-between bg-green-50/20 w-full">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-green-500 shrink-0" />
              <div>
                <p className="text-xs font-bold text-secondary">Verified Merchant</p>
                <p className="text-[10px] text-muted">KYC Level 2 Active</p>
              </div>
            </div>
          </div>
        </div>

        {/* Danger Zone / Logout */}
        <div className="pt-8 mt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-center sm:text-left">
            <h4 className="text-sm font-bold text-secondary">Session Management</h4>
            <p className="text-[10px] text-muted uppercase tracking-widest mt-1">End your current secure session</p>
          </div>
          <button 
            onClick={() => {
              if (confirm('Are you sure you want to sign out?')) {
                logout();
              }
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition-all border border-red-100 group"
          >
            <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Logout from PayFlow
          </button>
        </div>
      </div>
    </div>
  );
}
