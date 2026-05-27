'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  MoreVertical,
  ExternalLink,
  Search,
  X,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Bell,
  Copy,
  QrCode,
  CreditCard,
  User,
  Activity,
  CheckCircle,
  Clock
} from 'lucide-react';
import { io } from 'socket.io-client';
import { API_URL, apiFetch } from '@/lib/api';

interface Payment {
  id: string;
  name: string;
  amount: string;
  currency: string;
  status: string;
  created: string;
  utr_id?: string;
  creation_timestamp?: number;
  qr_link?: string;
  cf_upi_link?: string;
  checkout_url?: string;
  merchant_name?: string;
  email?: string;
  username?: string;
}

function ActionMenu({ pageId, qrLink, cfUpiLink, checkoutUrl, onOpenCheckout }: { pageId: string, qrLink?: string, cfUpiLink?: string, checkoutUrl?: string, onOpenCheckout: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopy = () => {
    const url = checkoutUrl || `${window.location.origin}/checkout/${pageId}`;
    navigator.clipboard.writeText(url);
    alert("Link copied to clipboard!");
    setIsOpen(false);
  };

  const handleCopyQR = () => {
    const link = cfUpiLink || qrLink;
    if (link) {
      navigator.clipboard.writeText(link);
      alert("QR Link copied to clipboard!");
    }
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-1.5 rounded-lg transition-all ${isOpen ? 'bg-slate-100 text-secondary shadow-inner' : 'text-muted hover:text-secondary hover:bg-slate-50'}`}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-44 bg-white border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right">
          <div className="p-1">
            <button
              onClick={onOpenCheckout}
              className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold text-secondary hover:bg-slate-50 rounded-lg transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-primary" /> Open Checkout
            </button>
            <button
              onClick={handleCopy}
              className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold text-secondary hover:bg-slate-50 rounded-lg transition-colors"
            >
              <Copy className="w-3.5 h-3.5 text-primary" /> Copy Checkout Link
            </button>
            {qrLink && (
              <button
                onClick={handleCopyQR}
                className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold text-secondary hover:bg-slate-50 rounded-lg transition-colors"
              >
                <QrCode className="w-3.5 h-3.5 text-primary" /> Copy QR Link
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminTransactionsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Pending' | 'Flagged'>('All');

  const fetchPayments = async () => {
    setIsLoading(true);
    setConnectionError(false);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await apiFetch(`/admin/payments`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setPayments(data);
      } else {
        setPayments([]);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      setConnectionError(true);
      setPayments([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();

    const socket = io(API_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      console.log('Admin Transactions Socket Connected');
    });

    socket.on('payment_update', (data) => {
      console.log('Received real-time update in AdminTransactionsPage:', data);
      fetchPayments();

      if (data.type === 'UTR_SUBMITTED' || data.type === 'PAYMENT_PAID') {
        return;
      }

      const newNotification = {
        ...data,
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
      setNotifications(prev => [newNotification, ...prev]);

      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== newNotification.id));
      }, 10000);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleOpenCheckout = (id: string, checkoutUrl?: string) => {
    const url = checkoutUrl || `/checkout/${id}`;
    window.open(url, '_blank');
  };

  const stats = useMemo(() => {
    let totalCount = payments.length;
    let totalVolume = 0;

    let paidCount = 0;
    let paidVolume = 0;

    let pendingCount = 0;
    let pendingVolume = 0;

    let flaggedCount = 0;
    let flaggedVolume = 0;

    payments.forEach(p => {
      const amt = parseFloat(p.amount) || 0;
      totalVolume += amt;

      if (p.status === 'Paid' || p.status === 'Success') {
        paidCount++;
        paidVolume += amt;
      } else if (p.status === 'Pending' || p.status === 'Active') {
        pendingCount++;
        pendingVolume += amt;
      } else if (p.status === 'Flagged') {
        flaggedCount++;
        flaggedVolume += amt;
      }
    });

    return {
      totalCount,
      totalVolume: totalVolume.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      paidCount,
      paidVolume: paidVolume.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      pendingCount,
      pendingVolume: pendingVolume.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      flaggedCount,
      flaggedVolume: flaggedVolume.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    };
  }, [payments]);

  const paymentsWithSr = useMemo(() => {
    return [...payments]
      .sort((a, b) => (b.creation_timestamp || 0) - (a.creation_timestamp || 0))
      .map((p, index) => ({ ...p, sr: index + 1 }));
  }, [payments]);

  const filteredPayments = useMemo(() => {
    return paymentsWithSr.filter(payment => {
      const matchesSearch =
        payment.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payment.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (payment.merchant_name && payment.merchant_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (payment.username && payment.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
        ((payment as any).user_id && (payment as any).user_id.toLowerCase().includes(searchQuery.toLowerCase()));

      let matchesStatus = true;
      if (statusFilter === 'Paid') {
        matchesStatus = payment.status === 'Paid' || payment.status === 'Success';
      } else if (statusFilter === 'Pending') {
        matchesStatus = payment.status === 'Pending' || payment.status === 'Active';
      } else if (statusFilter === 'Flagged') {
        matchesStatus = payment.status === 'Flagged';
      }

      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, paymentsWithSr, statusFilter]);

  const effectiveItemsPerPage = itemsPerPage === -1 ? filteredPayments.length : itemsPerPage;
  const totalPages = Math.ceil(filteredPayments.length / (effectiveItemsPerPage || 1));

  const paginatedPayments = useMemo(() => {
    if (itemsPerPage === -1) return filteredPayments;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPayments.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPayments, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage, statusFilter]);

  return (
    <div className="p-4 md:p-8 page-entry relative">

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-secondary tracking-tight">System Transactions</h1>
          <p className="text-xs md:text-sm text-muted">Complete audit logs of all global customer payments.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 bg-white border border-border px-3 py-2 rounded-lg shadow-sm">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Show:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(parseInt(e.target.value))}
              className="bg-transparent text-xs font-bold text-secondary focus:outline-none cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={-1}>All</option>
            </select>
          </div>
        </div>
      </div>

      {/* Dynamic Summary/KPI Boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Total Transactions Box */}
        <button
          onClick={() => setStatusFilter('All')}
          className={`text-left rounded-xl p-4 border transition-all flex items-center justify-between group ${statusFilter === 'All'
              ? 'bg-slate-50/50 border-primary ring-1 ring-primary shadow-lg shadow-blue-50/50'
              : 'bg-white border-border hover:border-slate-300 shadow-sm hover:shadow-md'
            }`}
        >
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider">All Transactions</p>
            <h3 className="text-xl font-extrabold text-secondary">{stats.totalCount}</h3>
            <p className="text-[10px] text-muted font-bold">Volume: <span className="text-secondary">₹{stats.totalVolume}</span></p>
          </div>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${statusFilter === 'All' ? 'bg-primary text-white' : 'bg-slate-50 text-secondary group-hover:bg-slate-100'
            }`}>
            <Activity className="w-5 h-5" />
          </div>
        </button>

        {/* Success Transactions Box */}
        <button
          onClick={() => setStatusFilter('Paid')}
          className={`text-left rounded-xl p-4 border transition-all flex items-center justify-between group ${statusFilter === 'Paid'
              ? 'bg-emerald-50/20 border-emerald-500 ring-1 ring-emerald-500 shadow-lg shadow-emerald-50/30'
              : 'bg-white border-border hover:border-slate-300 shadow-sm hover:shadow-md'
            }`}
        >
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Success (Paid)</p>
            <h3 className="text-xl font-extrabold text-emerald-600">{stats.paidCount}</h3>
            <p className="text-[10px] text-muted font-bold">Volume: <span className="text-emerald-600">₹{stats.paidVolume}</span></p>
          </div>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${statusFilter === 'Paid' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100'
            }`}>
            <CheckCircle className="w-5 h-5" />
          </div>
        </button>

        {/* Pending Transactions Box */}
        <button
          onClick={() => setStatusFilter('Pending')}
          className={`text-left rounded-xl p-4 border transition-all flex items-center justify-between group ${statusFilter === 'Pending'
              ? 'bg-amber-50/20 border-amber-500 ring-1 ring-amber-500 shadow-lg shadow-amber-50/30'
              : 'bg-white border-border hover:border-slate-300 shadow-sm hover:shadow-md'
            }`}
        >
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Pending / Active</p>
            <h3 className="text-xl font-extrabold text-amber-600">{stats.pendingCount}</h3>
            <p className="text-[10px] text-muted font-bold">Volume: <span className="text-amber-600">₹{stats.pendingVolume}</span></p>
          </div>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${statusFilter === 'Pending' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-600 group-hover:bg-amber-100'
            }`}>
            <Clock className="w-5 h-5" />
          </div>
        </button>

        {/* Failed / Flagged Transactions Box */}
        <button
          onClick={() => setStatusFilter('Flagged')}
          className={`text-left rounded-xl p-4 border transition-all flex items-center justify-between group ${statusFilter === 'Flagged'
              ? 'bg-rose-50/20 border-rose-500 ring-1 ring-rose-500 shadow-lg shadow-rose-50/30'
              : 'bg-white border-border hover:border-slate-300 shadow-sm hover:shadow-md'
            }`}
        >
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Flagged (Alerts)</p>
            <h3 className="text-xl font-extrabold text-rose-600">{stats.flaggedCount}</h3>
            <p className="text-[10px] text-muted font-bold">Volume: <span className="text-rose-600">₹{stats.flaggedVolume}</span></p>
          </div>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${statusFilter === 'Flagged' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-600 group-hover:bg-rose-100'
            }`}>
            <AlertCircle className="w-5 h-5" />
          </div>
        </button>
      </div>

      <div className="premium-card rounded-xl overflow-hidden min-h-[400px]">
        <div className="px-4 md:px-6 py-4 border-b border-border bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative w-full md:w-64 group">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 transition-colors ${searchQuery ? 'text-primary' : 'text-muted'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search merchants, orders, usernames..."
              className="w-full pl-9 pr-4 py-1.5 bg-white border border-border rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-primary transition-all group-hover:border-primary/30"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-100 rounded-full"
              >
                <X className="w-3 h-3 text-muted" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-4 text-[10px] md:text-xs font-bold text-muted">
            <span>
              Showing {filteredPayments.length === 0 ? 0 : (itemsPerPage === -1 ? 1 : (currentPage - 1) * itemsPerPage + 1)}-{itemsPerPage === -1 ? filteredPayments.length : Math.min(filteredPayments.length, currentPage * itemsPerPage)} of {filteredPayments.length} transactions
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Fetching global transactions...</p>
          </div>
        ) : connectionError ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-6">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-2">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-secondary">Backend Connection Failed</p>
              <p className="text-xs text-muted max-w-[280px] mt-1">We couldn't reach the server. Please ensure the backend is running at {API_URL}.</p>
            </div>
            <button
              onClick={fetchPayments}
              className="px-6 py-2 bg-secondary text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all shadow-md"
            >
              Retry Connection
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full high-density-table text-left">
              <thead>
                <tr className="bg-slate-50/30">
                  <th className="w-12">SR.</th>
                  <th>Merchant</th>
                  <th>Payment Name</th>
                  <th>Order ID</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>UTR ID</th>
                  <th>Created</th>
                  <th className="text-center">Actions</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {paginatedPayments.map((payment, index) => (
                  <tr key={`${payment.id}-${index}`} className="hover:bg-slate-50 transition-colors align-middle group">
                    <td className="text-xs font-bold text-muted py-4">
                      {(payment as any).sr}
                    </td>
                    <td className="py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-secondary text-xs flex items-center gap-1.5">
                          <User className="w-3 h-3 text-primary" /> {payment.merchant_name || 'System'}
                        </span>
                        <span className="text-[10px] text-muted truncate max-w-[120px]">{payment.username ? `@${payment.username}` : 'N/A'}</span>
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-secondary text-xs">{payment.name}</span>
                      </div>
                    </td>
                    <td className="font-mono text-[10px] text-muted py-4">{payment.id}</td>
                    <td className="py-4 font-bold text-secondary text-xs">{payment.amount} <span className="text-[9px] text-muted ml-0.5 font-normal">{payment.currency}</span></td>
                    <td className="py-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${payment.status === 'Active' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          (payment.status === 'Paid' || payment.status === 'Success') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            payment.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              payment.status === 'Flagged' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                payment.status === 'Refunded' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                  'bg-slate-50 text-slate-500 border-slate-100'
                        }`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="py-4">
                      {payment.utr_id ? (
                        <span className="text-[10px] font-bold text-secondary bg-slate-100 px-2 py-1 rounded select-all">
                          {payment.utr_id}
                        </span>
                      ) : (
                        <span className="text-[9px] text-muted italic">Pending</span>
                      )}
                    </td>
                    <td className="text-[10px] text-muted py-4">{payment.created}</td>
                    <td className="py-4">
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => handleOpenCheckout(payment.id, payment.checkout_url)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-full hover:bg-primary hover:text-white transition-all shadow-sm shadow-blue-50"
                        >
                          OPEN <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-4 text-right pr-4 relative">
                      <ActionMenu
                        pageId={payment.id}
                        qrLink={payment.qr_link}
                        cfUpiLink={payment.cf_upi_link}
                        checkoutUrl={payment.checkout_url}
                        onOpenCheckout={() => handleOpenCheckout(payment.id, payment.checkout_url)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {paginatedPayments.length === 0 && (
              <div className="py-20 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-sm font-bold text-secondary">No transactions found</p>
                <p className="text-xs text-muted mt-1">Global transaction history will appear here.</p>
              </div>
            )}
          </div>
        )}

        {itemsPerPage !== -1 && totalPages > 1 && (
          <div className="px-4 md:px-6 py-6 border-t border-border flex flex-col items-center gap-4 bg-slate-50/10">
            <div className="flex items-center bg-white border border-border/50 rounded-lg shadow-sm overflow-hidden p-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1 || isLoading}
                className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-muted hover:text-secondary hover:bg-slate-50 disabled:opacity-20 transition-all rounded-md"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center px-1">
                {(() => {
                  const pages = [];
                  if (totalPages <= 5) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                  } else {
                    if (currentPage <= 3) {
                      pages.push(1, 2, 3, '...', totalPages);
                    } else if (currentPage >= totalPages - 2) {
                      pages.push(1, '...', totalPages - 2, totalPages - 1, totalPages);
                    } else {
                      pages.push(1, '...', currentPage, '...', totalPages);
                    }
                  }

                  return pages.map((page, i) => (
                    page === '...' ? (
                      <span key={`dots-${i}`} className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-muted text-xs font-bold">...</span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page as number)}
                        className={`w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-[10px] md:text-xs font-bold transition-all rounded-md mx-0.5 ${currentPage === page
                          ? 'bg-primary text-white shadow-md shadow-blue-200'
                          : 'text-muted hover:bg-slate-50 hover:text-secondary'
                          }`}
                      >
                        {page}
                      </button>
                    )
                  ));
                })()}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages || totalPages === 0 || isLoading}
                className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-muted hover:text-secondary hover:bg-slate-50 disabled:opacity-20 transition-all rounded-md"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
