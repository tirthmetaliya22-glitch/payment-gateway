'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Link as LinkIcon,
  Copy,
  ExternalLink,
  Search,
  X,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Bell,
  CheckCircle2
} from 'lucide-react';
import { io } from 'socket.io-client';
import { useAuth } from '@/components/AuthProvider';
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
}



export default function PaymentPagesPage() {
  const { userEmail, logout } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const popoverRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowModal(false);
      }
    };
    if (showModal) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showModal]);

  // Real-time Notifications State
  const [notifications, setNotifications] = useState<any[]>([]);

  // New Payment Form State
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newOrderId, setNewOrderId] = useState('');
  const [newReturnUrl, setNewReturnUrl] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchPayments = async () => {
    // Only show loading spinner on initial load, not on background refreshes
    if (payments.length === 0) setIsLoading(true);

    // Add a timeout controller (increased to 10s for Atlas DB)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      console.log("fetchPayments: localStorage token =", typeof window !== 'undefined' ? localStorage.getItem('sessionToken') : 'SSR');
      console.log("fetchPayments: sessionStorage token =", typeof window !== 'undefined' ? sessionStorage.getItem('sessionToken') : 'SSR');
      const res = await apiFetch(`/merchant/payments`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.status === 401 || res.status === 403) {
        console.warn("Unauthorized access to merchant payments page. Status:", res.status);
        logout();
        return;
      }

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setPayments(data);
        setConnectionError(false);
      } else {
        console.error("Received non-array data for payments:", data);
        setPayments([]);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        console.warn(`Backend connectivity issue: Server at ${API_URL} is unreachable. Retrying in 5s...`);
      } else if (err.name === 'AbortError') {
        console.warn("Fetch timed out - Backend is likely down or slow");
      } else {
        console.error("Failed to fetch payments:", err);
      }
      setConnectionError(true);
      setPayments([]);

      // Auto-retry after 5 seconds if connection failed
      const retryTimer = setTimeout(() => {
        if (connectionError) fetchPayments();
      }, 5000);
      return () => clearTimeout(retryTimer);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userEmail) {
      fetchPayments();
    }

    // Socket.IO Connection
    const socket = io(API_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      console.log('Merchant Payments Socket Connected');
    });

    socket.on('payment_update', (data) => {
      console.log('Received real-time update:', data);

      // For UTR updates, instantly update the local state so the row reflects changes immediately
      if (data.type === 'UTR_SUBMITTED' && data.payment_id) {
        setPayments(prev => prev.map(p =>
          p.id === data.payment_id
            ? { ...p, utr_id: data.utr, status: data.status || 'Pending' }
            : p
        ));
        return;
      }

      // Ignore PAYMENT_CREATED event fetches since they are already appended locally instantly without refresh
      if (data.type === 'PAYMENT_CREATED') {
        return;
      }

      // Also do a full refresh to ensure data is fully synced with the database
      if (userEmail) fetchPayments();
    });

    return () => {
      socket.disconnect();
    };
  }, [userEmail]);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail) {
      alert("You must be logged in to create a payment.");
      return;
    }
    setIsCreating(true);
    try {
      const res = await apiFetch(`/merchant/payments`, {
        method: 'POST',
        body: JSON.stringify({
          name: newName,
          amount: `₹${parseFloat(newAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          currency: 'INR',
          order_id: newOrderId || undefined,
          return_url: newReturnUrl || undefined,
          email: userEmail
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setPayments(prev => {
          if (prev.some(p => p.id === data.payment.id)) return prev;
          return [data.payment, ...prev];
        });
        setShowModal(false);
        setNewName('');
        setNewAmount('');
        setNewOrderId('');
        setNewReturnUrl('');
      }
    } catch (err) {
      alert("Failed to create payment link. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenCheckout = (id: string, checkoutUrl?: string) => {
    const url = checkoutUrl || `/checkout/${id}`;
    window.open(url, '_blank');
  };

  const handleCopyLink = (paymentId: string, checkoutUrl?: string) => {
    const url = checkoutUrl || `${window.location.origin}/checkout/${paymentId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(paymentId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredPages = useMemo(() => {
    return payments.filter(page => {
      // Show all transactions until they are successful (Paid, Refunded, Flagged) or Failed
      // Once completed, they move to the Transactions page only
      const isNotPaid = page.status !== 'Paid' && page.status !== 'Success' && page.status !== 'Refunded' && page.status !== 'Flagged' && page.status !== 'Failed';

      const matchesSearch =
        page.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        page.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ((page as any).user_id && (page as any).user_id.toLowerCase().includes(searchQuery.toLowerCase()));

      // Multi-tenant check: if payment has an email, it must match current user (case-insensitive)
      const isMyPayment = (page as any).email
        ? (page as any).email.toLowerCase() === userEmail?.toLowerCase()
        : true;

      return isNotPaid && matchesSearch && isMyPayment;
    })
      .sort((a, b) => (b.creation_timestamp || 0) - (a.creation_timestamp || 0));
  }, [searchQuery, payments]);

  const effectiveItemsPerPage = itemsPerPage === -1 ? filteredPages.length : itemsPerPage;
  const totalPages = Math.ceil(filteredPages.length / (effectiveItemsPerPage || 1));

  const paginatedPages = useMemo(() => {
    if (itemsPerPage === -1) return filteredPages;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPages.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPages, currentPage, itemsPerPage]);

  // Reset page when filters or itemsPerPage change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage]);

  return (
    <div className="p-4 md:p-8 page-entry relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-secondary tracking-tight">Payment Pages</h1>
          <p className="text-xs md:text-sm text-muted">Create and manage your hosted payment links.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto relative" ref={popoverRef}>
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
          <button
            onClick={() => setShowModal(!showModal)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 group"
          >
            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" /> <span>Create Link</span>
          </button>

          {/* Create Payment Popover (Floating exactly where we clicked) */}
          {showModal && (
            <div className="absolute right-0 top-full mt-2 bg-white border border-border rounded-2xl shadow-2xl z-[250] w-[calc(100vw-2rem)] sm:w-[400px] overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right text-left">
              <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-slate-50/50">
                <h2 className="text-sm md:text-base font-bold text-secondary">Create Payment Link</h2>
                <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
                  <X className="w-4 h-4 text-muted" />
                </button>
              </div>

              <form onSubmit={handleCreatePayment} className="p-4 md:p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Link Title</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Monthly Subscription"
                    className="w-full px-4 py-2 bg-slate-50 border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Amount (INR)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">₹</span>
                    <input
                      type="number"
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Order ID (Optional)</label>
                    <input
                      type="text"
                      value={newOrderId}
                      onChange={(e) => setNewOrderId(e.target.value)}
                      placeholder="e.g. ORD-123"
                      className="w-full px-4 py-2 bg-slate-50 border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Return URL (Optional)</label>
                    <input
                      type="url"
                      value={newReturnUrl}
                      onChange={(e) => setNewReturnUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-4 py-2 bg-slate-50 border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2.5 bg-slate-50 text-secondary rounded-xl text-xs font-bold hover:bg-slate-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Create Link'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      <div className="premium-card rounded-xl overflow-hidden min-h-[400px]">
        <div className="px-4 md:px-6 py-4 border-b border-border bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative w-full md:w-64 group">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 transition-colors ${searchQuery ? 'text-primary' : 'text-muted'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or ID..."
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
              Showing {filteredPages.length === 0 ? 0 : (itemsPerPage === -1 ? 1 : (currentPage - 1) * itemsPerPage + 1)}-{itemsPerPage === -1 ? filteredPages.length : Math.min(filteredPages.length, currentPage * itemsPerPage)} of {filteredPages.length} results
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Loading your payment pages...</p>
          </div>
        ) : connectionError ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-6">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-2">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-secondary">Backend Connection Lost</p>
              <p className="text-xs text-muted max-w-[280px] mt-1">We've lost connection to the server. Retrying automatically...</p>
            </div>
            <button
              onClick={fetchPayments}
              className="px-6 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all shadow-md"
            >
              Retry Now
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Desktop Table View */}
            <table className="w-full high-density-table text-left hidden md:table">
              <thead>
                <tr className="bg-slate-50/30">
                  <th className="w-12">SR.</th>
                  <th>Name</th>
                  <th>Order ID</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>UTR ID</th>
                  <th>Created</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPages.map((page, index) => (
                  <tr key={`${page.id}-${index}`} className="hover:bg-slate-50 transition-colors align-middle group">
                    <td className="text-xs font-bold text-muted py-4">
                      {itemsPerPage === -1 ? index + 1 : (currentPage - 1) * itemsPerPage + index + 1}
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleCopyLink(page.id, page.checkout_url)}
                          className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-colors shrink-0"
                          title="Copy Payment Link"
                        >
                          {copiedId === page.id ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500 hover:text-white" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        <span className="font-bold text-secondary text-sm">{page.name}</span>
                        {(page as any).created_by === 'admin' && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-100 text-[8px] font-black uppercase tracking-tighter ml-1">Admin Request</span>
                        )}

                      </div>
                    </td>
                    <td className="font-mono text-[10px] text-muted py-4">{page.id}</td>
                    <td className="py-4 font-bold text-secondary text-sm">{page.amount} <span className="text-[10px] text-muted ml-1 font-normal">{page.currency}</span></td>
                    <td className="py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${page.status === 'Active' ? 'bg-green-50 text-green-600 border-green-100' :
                        (page.status === 'Paid' || page.status === 'Success') ? 'bg-blue-50 text-blue-600 border-blue-100' :
                          page.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                            'bg-slate-50 text-slate-500 border-slate-100'
                        }`}>
                        {page.status}
                      </span>
                    </td>
                    <td className="py-4">
                      {page.utr_id ? (
                        <span className="text-[10px] font-bold text-secondary bg-slate-100 px-2 py-1 rounded select-all">
                          {page.utr_id}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted italic">Not Submitted</span>
                      )}
                    </td>
                    <td className="text-[10px] text-muted py-4">{page.created}</td>
                    <td className="py-4">
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => handleOpenCheckout(page.id, page.checkout_url)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-full hover:bg-primary hover:text-white transition-all shadow-sm shadow-blue-50"
                        >
                          OPEN <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-border">
              {paginatedPages.map((page, index) => (
                <div key={`mob-pay-${page.id}-${index}`} className="p-4 space-y-4 hover:bg-slate-50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleCopyLink(page.id, page.checkout_url)}
                        className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-colors shrink-0"
                        title="Copy Payment Link"
                      >
                        {copiedId === page.id ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500 hover:text-white" />
                        ) : (
                          <Copy className="w-5 h-5" />
                        )}
                      </button>
                      <div>
                        <h4 className="font-bold text-secondary text-sm">{page.name}</h4>
                        <p className="font-mono text-[9px] text-muted">{page.id}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${page.status === 'Active' ? 'bg-green-50 text-green-600 border-green-100' :
                        (page.status === 'Paid' || page.status === 'Success') ? 'bg-blue-50 text-blue-600 border-blue-100' :
                          page.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                            'bg-slate-50 text-slate-500 border-slate-100'
                        }`}>
                        {page.status}
                      </span>
                      <p className="font-bold text-secondary text-sm">{page.amount}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl">
                    <div className="space-y-0.5">
                      <p className="text-[8px] font-bold text-muted uppercase">UTR ID</p>
                      <p className="text-[10px] font-bold text-secondary truncate">{page.utr_id || 'Not Submitted'}</p>
                    </div>
                    <div className="space-y-0.5 text-right">
                      <p className="text-[8px] font-bold text-muted uppercase">Created</p>
                      <p className="text-[10px] font-bold text-secondary">{page.created}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenCheckout(page.id, page.checkout_url)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-primary text-white text-[10px] font-bold rounded-lg shadow-md shadow-blue-100"
                    >
                      OPEN CHECKOUT <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {paginatedPages.length === 0 && (
              <div className="py-20 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <LinkIcon className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-sm font-bold text-secondary">No payment pages found</p>
                <p className="text-xs text-muted mt-1">Create your first link to start accepting payments.</p>
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

