'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  ArrowUpRight,
  Server,
  Zap,
  MoreVertical,
  Loader2,
  Eye,
  EyeOff,
  User,
  Key,
  ShieldAlert,
  ChevronRight,
  CheckCircle2,
  Clock,
  Download
} from 'lucide-react';
import Link from 'next/link';

import { API_URL, apiFetch } from '@/lib/api';

function AdminActionMenu({ merchantId }: { merchantId: string }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-1.5 rounded-lg transition-all ${isOpen ? 'bg-slate-100 text-secondary' : 'text-muted hover:text-secondary hover:bg-slate-50'}`}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-44 bg-white border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right">
          <div className="p-1">
            <Link
              href={`/admin/merchants?id=${merchantId}`}
              className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold text-secondary hover:bg-slate-50 rounded-lg transition-colors"
            >
              <User className="w-3.5 h-3.5 text-primary" /> View Profile
            </Link>
            <Link
              href={`/admin/merchants/set-password/${merchantId}`}
              className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold text-secondary hover:bg-slate-50 rounded-lg transition-colors"
            >
              <Key className="w-3.5 h-3.5 text-primary" /> Reset Password
            </Link>
            <div className="h-px bg-slate-100 my-1 mx-1" />
            <button
              onClick={() => { alert("Account deactivated."); setIsOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <ShieldAlert className="w-3.5 h-3.5" /> Deactivate Account
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [merchants, setMerchants] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const togglePassword = (id: string) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setError(null);
        const [statsRes, merchantsRes] = await Promise.all([
          apiFetch(`/admin/stats`),
          apiFetch(`/admin/merchants`)
        ]);

        if ([401, 403].includes(statsRes.status) || [401, 403].includes(merchantsRes.status)) {
          console.warn("Unauthorized access to admin dashboard. Status codes:", statsRes.status, merchantsRes.status);
          setError("Your session has expired or you are not authorized to view this page. Please log in as an administrator.");
          setIsLoading(false);
          return;
        }

        if (!statsRes.ok || !merchantsRes.ok) {
          console.error("Fetch failed. Status codes:", statsRes.status, merchantsRes.status);
          throw new Error(`Failed to fetch data from server (Status: ${statsRes.status}/${merchantsRes.status})`);
        }

        const statsData = await statsRes.json();
        const merchantsData = await merchantsRes.json();

        setStats(statsData);
        setMerchants(merchantsData.slice(0, 5)); // Just top 5 for dashboard
      } catch (err) {
        if (err instanceof TypeError && err.message === 'Failed to fetch') {
          console.warn(`Backend connectivity issue: Server at ${API_URL} is unreachable.`);
          setError(`Unable to connect to the backend server. Please ensure the backend is running and accessible at ${API_URL}.`);
        } else {
          console.error("Failed to fetch admin data:", err);
          setError(err instanceof Error ? err.message : "An unexpected error occurred while fetching data.");
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 page-entry">
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-red-500" />
            <div>
              <p className="text-red-800 text-xs font-bold">Backend Connectivity Error</p>
              <p className="text-red-600 text-[10px]">{error}</p>
            </div>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-[10px] font-bold hover:bg-red-200 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-secondary tracking-tight">Platform Overview</h1>
          <p className="text-xs md:text-sm text-muted">Mission-critical metrics and infrastructure status.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => {
              if (!merchants || merchants.length === 0) {
                alert("No data to export");
                return;
              }
              const excludeFields = [
                'volume', 'status', 'joined', 'created_at', 'phone', 
                'updated_at', 'email', 'password', 'merchant_key', 'salt_key'
              ];
              const headers = Object.keys(merchants[0]).filter(key => !excludeFields.includes(key));
              
              const csvRows = merchants.map(row => 
                headers.map(key => {
                  const value = row[key];
                  const strVal = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
                  return `"${strVal.replace(/"/g, '""')}"`;
                }).join(',')
              );
              const csvString = [headers.join(','), ...csvRows].join('\n');
              const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csvString);
              const downloadAnchorNode = document.createElement('a');
              downloadAnchorNode.setAttribute("href", dataStr);
              downloadAnchorNode.setAttribute("download", "admin_merchants_export.csv");
              document.body.appendChild(downloadAnchorNode);
              downloadAnchorNode.click();
              downloadAnchorNode.remove();
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-white border border-border rounded-md text-xs md:text-sm font-medium text-secondary hover:bg-slate-50 transition-colors"
          >
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Core Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="premium-card p-6 rounded-xl border-l-4 border-l-primary hover:scale-[1.03] transition-all duration-300 slide-up slide-up-1">
          <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Active Merchants</p>
          <h3 className="text-2xl font-bold text-secondary">{stats?.merchants || 0}</h3>
          <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-green-600">
            <ArrowUpRight className="w-3 h-3" /> Live from DB
          </div>
        </div>

        <div className="premium-card p-6 rounded-xl hover:scale-[1.03] transition-all duration-300 slide-up slide-up-2">
          <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Platform Throughput</p>
          <h3 className="text-2xl font-bold text-secondary">{stats?.total_volume || '₹0M'}<span className="text-sm text-muted">/hr</span></h3>
          <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-primary">
            <TrendingUp className="w-3 h-3" /> Peak Performance
          </div>
        </div>

        <div className="premium-card p-6 rounded-xl hover:scale-[1.03] transition-all duration-300 slide-up slide-up-3">
          <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">New Inquiries</p>
          <h3 className="text-2xl font-bold text-secondary">{stats?.new_inquiries || 0}</h3>
          <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-blue-600 uppercase">
            Pending Review
          </div>
        </div>

        <div className="premium-card p-6 rounded-xl hover:scale-[1.03] transition-all duration-300 slide-up slide-up-4">
          <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Open Tickets</p>
          <h3 className="text-2xl font-bold text-secondary">{stats?.open_tickets || 0}</h3>
          <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-red-600">
            <Zap className="w-3 h-3" /> Needs Attention
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Merchant Table */}
        <div className="premium-card rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-slate-50/50">
            <h3 className="text-sm font-bold text-secondary uppercase tracking-wider">Merchant Management</h3>
            <Link href="/admin/merchants" className="text-xs font-bold text-primary">View Full Directory</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full high-density-table text-left min-w-[700px] md:min-w-0">
              <thead>
                <tr className="bg-slate-50/30">
                  <th className="whitespace-nowrap">Merchant ID</th>
                  <th className="whitespace-nowrap">Name</th>
                  <th className="whitespace-nowrap hidden sm:table-cell">Plan</th>
                  <th className="whitespace-nowrap hidden lg:table-cell">Vol (30D)</th>
                  <th className="whitespace-nowrap">Status</th>
                  <th className="whitespace-nowrap hidden xl:table-cell">Password</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="stagger-entry">
                {merchants.map((m, index) => (
                  <tr key={m.merchant_id || `dashboard-m-${index}`} className="hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 group">
                    <td className="font-mono text-xs text-muted whitespace-nowrap">{m.merchant_id}</td>
                    <td className="font-bold text-secondary whitespace-nowrap">{m.name}</td>
                    <td className="hidden sm:table-cell whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${m.plan === 'Enterprise' ? 'bg-purple-50 text-purple-600 border border-purple-100' : 'bg-blue-50 text-blue-600 border border-blue-100'
                        }`}>
                        {m.plan}
                      </span>
                    </td>
                    <td className="font-medium text-secondary hidden lg:table-cell whitespace-nowrap">{m.volume}</td>
                    <td className="whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${m.status === 'Healthy' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                        <span className="text-xs font-medium text-secondary">{m.status}</span>
                      </div>
                    </td>
                    <td className="hidden xl:table-cell whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <code className="text-[10px] font-bold text-slate-500 bg-slate-50 px-1 py-0.5 rounded border border-slate-100 min-w-[70px]">
                          {visiblePasswords[m.merchant_id] ? (m.password || '••••••••') : '••••••••'}
                        </code>
                        <button
                          onClick={() => togglePassword(m.merchant_id)}
                          className="p-1 hover:bg-slate-100 rounded text-muted hover:text-secondary transition-colors"
                        >
                          {visiblePasswords[m.merchant_id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                      </div>
                    </td>
                    <td className="py-4 text-right pr-4 md:pr-6 relative whitespace-nowrap">
                      <AdminActionMenu merchantId={m.merchant_id} />
                    </td>
                  </tr>
                ))}
                {merchants.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted italic">No merchants found in database.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest text-center sm:text-left">Showing top {merchants.length} of {stats?.merchants || merchants.length} merchants</p>
            <div className="flex gap-2">
              <button className="px-3 py-1 bg-white border border-border rounded text-[10px] font-bold text-muted opacity-30 cursor-not-allowed">Previous</button>
              <button className="px-3 py-1 bg-primary text-white border border-primary rounded text-[10px] font-bold">1</button>
              <button className="px-3 py-1 bg-white border border-border rounded text-[10px] font-bold text-muted opacity-30 cursor-not-allowed">Next</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

