'use client';

import React, { useState } from 'react';
import { 
  Settings, 
  Shield, 
  Globe, 
  Bell, 
  Database, 
  Lock, 
  Save, 
  RefreshCw,
  Server,
  Zap,
  Mail,
  Smartphone,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  LogOut
} from 'lucide-react';
import { useAuth } from "../../../components/AuthProvider";

import { API_URL, apiFetch } from '@/lib/api';

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const { logout } = useAuth();

  // Form States
  const [generalSettings, setGeneralSettings] = useState({
    platformName: 'PayFlow Gateway',
    supportEmail: 'support@payflow.com',
    timezone: 'UTC +00:00',
    maintenanceMode: false
  });

  const [securitySettings, setSecuritySettings] = useState({
    requireTwoFactor: true,
    sessionExpiry: '24 Hours',
    passwordPolicy: 'Strong',
    ipWhitelisting: false
  });

  const [apiSettings, setApiSettings] = useState({
    endpointUrl: 'https://api.payflow.com/v1',
    webhookSecret: 'whsec_51MzZkS2VsdWR1M2...',
    requestLimit: '10,000 / hr',
    logRetention: '90 Days'
  });

  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await apiFetch(`/admin/settings`);
        if (res.ok) {
          const data = await res.json();
          if (data.general) setGeneralSettings(prev => ({ ...prev, ...data.general }));
          if (data.security) setSecuritySettings(prev => ({ ...prev, ...data.security }));
          if (data.api) setApiSettings(prev => ({ ...prev, ...data.api }));
        }
      } catch (err) {
        if (err instanceof TypeError && err.message === 'Failed to fetch') {
          console.warn(`Backend connectivity issue: Server at ${API_URL} is unreachable. Using default settings.`);
        } else {
          console.error("Failed to fetch settings:", err);
        }
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await apiFetch(`/admin/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          general: generalSettings,
          security: securitySettings,
          api: apiSettings
        })
      });

      if (res.ok) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error('Settings save failed:', res.status, errData);
        alert(`Failed to save settings (${res.status}): ${errData?.detail || errData?.message || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error("Save failed:", err);
      alert(`Failed to save settings: ${err.message || 'Network error. Please check your connection.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 page-entry">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-secondary tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" /> Platform Settings
          </h1>
          <p className="text-xs md:text-sm text-muted">Configure global platform behavior and security protocols.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-white rounded-md text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-70"
        >
          {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isSaving ? 'Saving Changes...' : 'Save All Settings'}
        </button>
      </div>

      {showSuccess && (
        <div className="mb-6 p-4 bg-green-50 border border-green-100 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <p className="text-sm font-bold text-green-800">Settings updated successfully. All nodes synchronized.</p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Tabs */}
        <div className="w-full lg:w-64 shrink-0 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-4 lg:pb-0 no-scrollbar">
          {[
            { id: 'general', label: 'General', icon: Globe },
            { id: 'security', label: 'Security', icon: Shield },
            { id: 'api', label: 'API & Webhooks', icon: Zap },
            { id: 'notifications', label: 'Notifications', icon: Bell },
            { id: 'database', label: 'Data Management', icon: Database },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap min-w-fit lg:w-full ${
                activeTab === tab.id 
                  ? 'bg-primary text-white shadow-md' 
                  : 'text-muted hover:bg-white hover:text-secondary'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
          
          <div className="lg:mt-auto pt-4 lg:pt-8">
            <button
              onClick={() => {
                if (confirm('Are you sure you want to terminate the secure admin session?')) {
                  logout();
                }
              }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 transition-all w-full border border-transparent hover:border-red-100 group"
            >
              <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 space-y-6">
          {activeTab === 'general' && (
            <div className="premium-card rounded-2xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="px-6 md:px-8 py-6 border-b border-border bg-slate-50/50">
                <h3 className="font-bold text-secondary text-sm md:text-base">General Platform Configuration</h3>
              </div>
              <div className="p-6 md:p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Platform Name</label>
                    <input 
                      type="text" 
                      value={generalSettings.platformName}
                      onChange={(e) => setGeneralSettings({...generalSettings, platformName: e.target.value})}
                      className="w-full px-4 py-3 bg-white border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Support Email</label>
                    <input 
                      type="email" 
                      value={generalSettings.supportEmail}
                      onChange={(e) => setGeneralSettings({...generalSettings, supportEmail: e.target.value})}
                      className="w-full px-4 py-3 bg-white border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-slate-50 rounded-2xl border border-border gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-yellow-50 flex items-center justify-center text-yellow-600 shrink-0">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-secondary text-sm md:text-base">Maintenance Mode</h4>
                      <p className="text-xs text-muted">Temporarily disable merchant access to the platform.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setGeneralSettings({...generalSettings, maintenanceMode: !generalSettings.maintenanceMode})}
                    className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${generalSettings.maintenanceMode ? 'bg-yellow-500' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${generalSettings.maintenanceMode ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="premium-card rounded-2xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="px-8 py-6 border-b border-border bg-slate-50/50">
                <h3 className="font-bold text-secondary">Security & Authentication</h3>
              </div>
              <div className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Session Expiry</label>
                    <select 
                      value={securitySettings.sessionExpiry}
                      onChange={(e) => setSecuritySettings({...securitySettings, sessionExpiry: e.target.value})}
                      className="w-full px-4 py-3 bg-white border border-border rounded-xl text-sm outline-none cursor-pointer"
                    >
                      <option>1 Hour</option>
                      <option>12 Hours</option>
                      <option>24 Hours</option>
                      <option>7 Days</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Password Policy</label>
                    <select 
                      value={securitySettings.passwordPolicy}
                      onChange={(e) => setSecuritySettings({...securitySettings, passwordPolicy: e.target.value})}
                      className="w-full px-4 py-3 bg-white border border-border rounded-xl text-sm outline-none cursor-pointer"
                    >
                      <option>Standard</option>
                      <option>Strong</option>
                      <option>Enterprise</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-5 h-5 text-primary" />
                      <div>
                        <h4 className="text-sm font-bold text-secondary">Enforce 2FA</h4>
                        <p className="text-xs text-muted">Require two-factor authentication for all admin users.</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSecuritySettings({...securitySettings, requireTwoFactor: !securitySettings.requireTwoFactor})}
                      className={`relative w-12 h-6 rounded-full transition-colors ${securitySettings.requireTwoFactor ? 'bg-primary' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${securitySettings.requireTwoFactor ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <Lock className="w-5 h-5 text-primary" />
                      <div>
                        <h4 className="text-sm font-bold text-secondary">IP Whitelisting</h4>
                        <p className="text-xs text-muted">Restrict admin access to specific IP ranges.</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSecuritySettings({...securitySettings, ipWhitelisting: !securitySettings.ipWhitelisting})}
                      className={`relative w-12 h-6 rounded-full transition-colors ${securitySettings.ipWhitelisting ? 'bg-primary' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${securitySettings.ipWhitelisting ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="premium-card rounded-2xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="px-8 py-6 border-b border-border bg-slate-50/50">
                <h3 className="font-bold text-secondary">API & Developer Access</h3>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Base API Endpoint</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      readOnly
                      value={apiSettings.endpointUrl}
                      className="flex-1 px-4 py-3 bg-slate-50 border border-border rounded-xl text-sm font-mono text-muted outline-none"
                    />
                    <button className="px-4 bg-white border border-border rounded-xl hover:bg-slate-50 transition-colors">
                      <RefreshCw className="w-4 h-4 text-muted" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Global Webhook Secret</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input 
                        type={showWebhookSecret ? 'text' : 'password'} 
                        readOnly
                        value={apiSettings.webhookSecret}
                        className="w-full px-4 py-3 pr-12 bg-slate-50 border border-border rounded-xl text-sm font-mono text-muted outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowWebhookSecret(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-slate-200 transition-colors"
                      >
                        {showWebhookSecret
                          ? <EyeOff className="w-4 h-4 text-muted" />
                          : <Eye className="w-4 h-4 text-muted" />}
                      </button>
                    </div>
                    <button className="px-6 bg-secondary text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors">
                      Rotate Secret
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
                   <div className="p-4 bg-slate-50 rounded-xl border border-border">
                      <p className="text-[10px] font-bold text-muted uppercase">Rate Limit</p>
                      <p className="text-base md:text-lg font-bold text-secondary mt-1">{apiSettings.requestLimit}</p>
                   </div>
                   <div className="p-4 bg-slate-50 rounded-xl border border-border">
                      <p className="text-[10px] font-bold text-muted uppercase">Log Retention</p>
                      <p className="text-base md:text-lg font-bold text-secondary mt-1">{apiSettings.logRetention}</p>
                   </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
             <div className="premium-card rounded-2xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="p-20 text-center space-y-4">
                   <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-primary mx-auto">
                      <Mail className="w-8 h-8" />
                   </div>
                   <h3 className="text-xl font-bold text-secondary">Notification Engine</h3>
                   <p className="text-sm text-muted max-w-xs mx-auto">SMTP and SMS gateways are managed by the infrastructure team. Contact support for configuration changes.</p>
                </div>
             </div>
          )}

          {activeTab === 'database' && (
             <div className="premium-card rounded-2xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="p-12 space-y-8">
                   <div className="flex items-center gap-6">
                      <div className="w-20 h-20 rounded-3xl bg-slate-900 flex flex-col items-center justify-center text-white">
                         <Database className="w-8 h-8" />
                         <span className="text-[8px] font-bold mt-1">MONGO</span>
                      </div>
                      <div>
                         <h3 className="text-xl font-bold text-secondary">Primary Cluster Health</h3>
                         <div className="flex items-center gap-4 mt-2">
                            <div className="flex items-center gap-1.5">
                               <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                               <span className="text-xs font-bold text-green-600">CONNECTED</span>
                            </div>
                            <span className="text-xs text-muted font-medium">Latency: 2ms</span>
                            <span className="text-xs text-muted font-medium">Storage: 42.8 GB / 512 GB</span>
                         </div>
                      </div>
                   </div>

                   <div className="space-y-4 pt-4 border-t border-border">
                      <button className="w-full py-4 bg-slate-50 hover:bg-slate-100 rounded-xl border border-border text-sm font-bold text-secondary flex items-center justify-center gap-3 transition-all group">
                         <RefreshCw className="w-4 h-4 text-muted group-hover:rotate-180 transition-transform duration-500" />
                         Run Database Maintenance Job
                      </button>
                      <button className="w-full py-4 bg-white hover:bg-red-50 rounded-xl border border-border text-sm font-bold text-red-600 flex items-center justify-center gap-3 transition-all">
                         <AlertTriangle className="w-4 h-4" />
                         Purge All Cache & Temporary Data
                      </button>
                   </div>
                </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
