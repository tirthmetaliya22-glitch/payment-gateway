"use client";

import React, { useEffect, useState, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Shield,
  Terminal,
  LifeBuoy,
  Settings,
  Search,
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  X,
  Globe,
  CheckCircle,
  AlertCircle,
  Info,
  User,
  WifiOff,
  RefreshCw,
  CreditCard,
  Activity,
  Wallet
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from "../../components/AuthProvider";
import { useConnectivity } from "@/hooks/useConnectivity";
import { ConnectivityBanner } from "@/components/ConnectivityBanner";

import { API_URL } from '@/lib/api';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const { isLoggedIn, userEmail, userRole, logout, isAuthChecking } = useAuth();

  const { isBackendOnline, isCheckingHealth, checkHealth } = useConnectivity();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [activeToast, setActiveToast] = useState<{ id: any; title: string; description: string; type: 'success' | 'warning' | 'info'; redirect_url?: string } | null>(null);

  useEffect(() => {
    if (!isLoggedIn || userRole !== 'admin' || !API_URL) return;

    // Load socket.io-client dynamically to avoid SSR issues
    const { io } = require('socket.io-client');
    const socket = io(API_URL);

    socket.on('connect', () => {
      console.log('[Admin Layout] Socket connected');
    });

    socket.on('payment_update', (data: any) => {
      console.log('[Admin Layout] Received live update:', data);

      let title = 'Payment Update';
      let type: 'success' | 'warning' | 'info' = 'info';

      if (data.type === 'NEW_PAYMENT') {
        title = 'New Payment Request';
        type = 'success';
      } else if (data.type === 'PAYMENT_CREATED') {
        title = 'Payment Link Created';
        type = 'success';
      } else if (data.type === 'UTR_SUBMITTED') {
        title = 'UTR Update Submitted';
        type = 'warning';
      } else if (data.type === 'PAYMENT_PAID') {
        title = 'Payment Successful';
        type = 'success';
      }

      // Add to notifications list
      const newNotif = {
        id: Date.now(),
        title: title,
        description: data.message || 'A live update was received.',
        time: 'Just now',
        type: type,
        read: false,
        redirect_url: data.redirect_url
      };

      setNotifications(prev => [newNotif, ...prev].slice(0, 20));
      if (data.type !== 'UTR_SUBMITTED') {
        setActiveToast(newNotif);
      }

      // Auto-dismiss toast by changing time after 8 seconds
      setTimeout(() => {
        setNotifications(prev => prev.map(n => n.id === newNotif.id ? { ...n, time: '1 min ago' } : n));
      }, 8000);
      
      // Auto-dismiss visual toast popup after 8 seconds
      setTimeout(() => {
        setActiveToast(current => current?.id === newNotif.id ? null : current);
      }, 8000);
    });

    return () => {
      socket.disconnect();
    };
  }, [isLoggedIn, userRole]);

  useEffect(() => {
    // Initial dummy notifications for look & feel
    setNotifications([
      { id: 1, title: 'New Merchant Inquiry', description: 'Arjun Mehta requested a demo for Enterprise plan.', time: '2 mins ago', type: 'info', read: false },
      { id: 2, title: 'System Healthy', description: 'All nodes synchronized across 24 clusters.', time: '1 hr ago', type: 'success', read: true },
      { id: 3, title: 'Database Backup', description: 'Weekly snapshot completed successfully.', time: '5 hrs ago', type: 'success', read: true },
      { id: 4, title: 'Security Alert', description: 'Unauthorized login attempt blocked from IP 192.x.x.x', time: 'Yesterday', type: 'warning', read: true },
    ]);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/admin/merchants?search=${encodeURIComponent(searchQuery)}`;
    }
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/admin' },
    { icon: Users, label: 'Merchants', href: '/admin/merchants' },
    { icon: Wallet, label: 'Wallets', href: '/admin/wallets' },
    { icon: CreditCard, label: 'Payments', href: '/admin/payments' },
    { icon: Activity, label: 'Transactions', href: '/admin/transactions' },
    { icon: Terminal, label: 'Withdrawals', href: '/admin/withdrawals' },
    { icon: Terminal, label: 'Audit Logs', href: '/admin/logs' },

    { icon: Settings, label: 'Platform Settings', href: '/admin/settings' },
  ];

  // Show loading state while auth is being checked
  if (isAuthChecking) {
    return (
      <div className="flex h-screen bg-surface admin-emerald items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-muted animate-pulse">Verifying Access...</p>
        </div>
      </div>
    );
  }

  // Allow the admin login page to be viewed without authentication
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  // If not logged in or not an admin, show access denied with login link
  if (!isLoggedIn || userRole !== 'admin') {
    return (
      <div className="flex h-screen bg-surface admin-emerald items-center justify-center">
        <div className="flex flex-col items-center gap-6 max-w-md text-center px-6 page-entry">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center">
            <Shield className="w-8 h-8 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-secondary mb-2">Access Restricted</h1>
            <p className="text-sm text-muted">
              {!isLoggedIn 
                ? "You must be logged in as an administrator to access this panel."
                : "Your account does not have administrator privileges."}
            </p>
          </div>
          <Link 
            href="/admin/login" 
            className="px-6 py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2"
          >
            Go to Admin Login <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-surface admin-emerald">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-border flex flex-col transition-transform duration-300 md:relative md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center text-white font-bold shadow-lg shadow-emerald-200">A</div>
            <span className="text-xl font-bold tracking-tight text-secondary">Admin Console</span>
          </div>
          <button
            className="md:hidden p-1 text-muted hover:text-secondary"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = item.href === '/admin' ? pathname === '/admin' : pathname?.startsWith(item.href);

            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 group ${isActive
                    ? 'bg-primary text-white shadow-md shadow-emerald-100 scale-[1.02]'
                    : 'text-muted hover:bg-slate-50 hover:text-secondary focus:bg-emerald-50 focus:text-primary hover:translate-x-1'
                  }`}
              >
                <item.icon className={`w-4 h-4 transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className={`w-2 h-2 rounded-full ${isBackendOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className={`text-[10px] font-bold uppercase tracking-widest ${isBackendOnline ? 'text-muted' : 'text-red-500'}`}>
              {isBackendOnline ? 'System Online' : 'System Offline'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-border flex items-center justify-between px-4 md:px-8 shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <button
              className="md:hidden p-2 text-muted hover:text-secondary"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>

            <form onSubmit={handleSearch} className="relative w-full max-w-md hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </form>
          </div>

          <div className="flex items-center gap-2 md:gap-6">
            <div className="hidden lg:flex items-center gap-2 text-[10px] font-bold text-muted uppercase tracking-wider">
              <Globe className={`w-3.5 h-3.5 ${isBackendOnline ? 'text-primary' : 'text-red-500'}`} />
              <span>Nodes: {isBackendOnline ? '24/24' : '0/24'} Active</span>
            </div>
            <div className="hidden lg:block h-8 w-px bg-border mx-1 md:mx-2" />

            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className={`p-2 rounded-lg transition-all relative ${isNotificationsOpen ? 'bg-slate-100 text-secondary' : 'text-muted hover:text-secondary hover:bg-slate-50'}`}
              >
                <Bell className="w-5 h-5" />
                {notifications.some(n => !n.read) && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-white" />
                )}
              </button>

              {isNotificationsOpen && (
                <div className="absolute right-0 mt-3 w-[320px] sm:w-[360px] bg-white border border-border rounded-2xl shadow-2xl z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                  <div className="px-6 py-4 border-b border-border bg-slate-50/50 flex justify-between items-center">
                    <h3 className="text-xs font-bold text-secondary uppercase tracking-wider">System Alerts</h3>
                    <span className="text-[10px] font-bold text-primary bg-blue-50 px-2 py-0.5 rounded-full">
                      {notifications.filter(n => !n.read).length} NEW
                    </span>
                  </div>

                  <div className="max-h-[400px] overflow-y-auto">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`px-6 py-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer group relative ${!notification.read ? 'bg-blue-50/30' : ''}`}
                      >
                        {!notification.read && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                        <div className="flex gap-3">
                          <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${notification.type === 'success' ? 'bg-green-100 text-green-600' :
                              notification.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                                'bg-blue-100 text-blue-600'
                            }`}>
                            {notification.type === 'success' ? <CheckCircle className="w-4 h-4" /> :
                              notification.type === 'warning' ? <AlertCircle className="w-4 h-4" /> :
                                <Info className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-secondary mb-0.5">{notification.title}</p>
                            <p className="text-[11px] text-muted line-clamp-2 leading-relaxed">{notification.description}</p>
                            <p className="text-[10px] text-muted mt-2 font-medium">{notification.time}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-secondary hover:scale-105 transition-transform overflow-hidden border border-border"
              >
                <User className="w-4 h-4" />
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 mt-3 w-56 bg-white border border-border rounded-2xl shadow-2xl z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                  <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                    <p className="text-xs font-bold text-secondary">System Administrator</p>
                    <p className="text-[10px] text-muted">admin@payflow.com</p>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={checkHealth}
                      disabled={isCheckingHealth}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold text-secondary hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-primary ${isCheckingHealth ? 'animate-spin' : ''}`} /> Refresh Connectivity
                    </button>
                    <Link
                      href="/admin/settings"
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold text-secondary hover:bg-slate-50 transition-colors"
                      onClick={() => setIsProfileOpen(false)}
                    >
                      <Settings className="w-3.5 h-3.5 text-primary" /> Platform Settings
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 flex flex-col min-h-0 w-full relative">

          <ConnectivityBanner 
            isOnline={isBackendOnline} 
            isChecking={isCheckingHealth} 
            onRetry={checkHealth} 
          />
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>

          {/* Floating Toast Notification */}
          {activeToast && (
            <div className="fixed bottom-6 right-6 z-[9999] max-w-sm w-full bg-slate-900 text-white rounded-2xl shadow-2xl border border-white/10 p-4 flex gap-3 items-start animate-in slide-in-from-bottom-5 fade-in duration-300">
              <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                activeToast.type === 'success' ? 'bg-green-500/20 text-green-400' :
                activeToast.type === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                'bg-blue-500/20 text-blue-400'
              }`}>
                {activeToast.type === 'success' ? <CheckCircle className="w-4 h-4" /> :
                 activeToast.type === 'warning' ? <AlertCircle className="w-4 h-4" /> :
                 <Info className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white leading-tight">{activeToast.title}</p>
                <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed break-all select-all">{activeToast.description}</p>
                {activeToast.redirect_url && (
                  <Link 
                    href={activeToast.redirect_url} 
                    onClick={() => setActiveToast(null)}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 hover:underline mt-2"
                  >
                    View Details
                  </Link>
                )}
              </div>
              <button 
                onClick={() => setActiveToast(null)}
                className="p-1 hover:bg-white/10 rounded-md transition-colors text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

