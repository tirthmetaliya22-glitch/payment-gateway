'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Download,
  Search,
  Filter,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Eye,
  RotateCcw,
  Ban,
  X,
  Loader2,
  AlertCircle,
  Bell,
  ExternalLink
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
}

export default function TransactionsPage() {
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState('All');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState<Payment | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  const { userEmail, logout } = useAuth();
  const fetchPayments = async (showLoading = true) => {
    if (!userEmail) return;
    if (showLoading && payments.length === 0) setIsLoading(true);
    setConnectionError(false);
    try {
      const res = await apiFetch(`/merchant/payments`);
      if (res.status === 401 || res.status === 403) {
        console.warn("Unauthorized access to merchant payments. Status:", res.status);
        logout();
        return;
      }
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setPayments(data);
      } else {
        setPayments([]);
      }
    } catch (err) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        console.warn(`Backend connectivity issue: Server at ${API_URL} is unreachable.`);
      } else {
        console.error("Failed to fetch payments for transactions:", err);
      }
      setConnectionError(true);
      setPayments([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();

    // Socket.IO Connection for Real-time Updates
    const socket = io(API_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      console.log('[Transactions] Real-time connection established');
    });

    socket.on('connect_error', (error) => {
      console.warn('[Transactions] Socket connection error:', error);
    });

    socket.on('payment_update', (data) => {
      console.log('[Transactions] Received real-time update:', data);

      // For UTR updates, instantly update the local state so the row reflects changes immediately
      if (data.type === 'UTR_SUBMITTED' && data.payment_id) {
        setPayments(prev => prev.map(p =>
          p.id === data.payment_id
            ? { ...p, utr_id: data.utr, status: data.status || 'Pending' }
            : p
        ));
      }

      // For completed payments (PAYMENT_PAID), instantly update status to Success to include it in completed transactions list
      if (data.type === 'PAYMENT_PAID' && (data.order_id || data.payment_id)) {
        const targetId = data.order_id || data.payment_id;
        setPayments(prev => prev.map(p =>
          p.id === targetId
            ? { ...p, status: 'Success' }
            : p
        ));
      }

      // Also do a full refresh to ensure data is fully synced
      if (userEmail) fetchPayments(false);

      // Show notification only for non-UTR and non-PAYMENT_PAID events
      if (data.type !== 'UTR_SUBMITTED' && data.type !== 'PAYMENT_PAID') {
        const newNotification = {
          ...data,
          id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };
        setNotifications(prev => [newNotification, ...prev]);

        setTimeout(() => {
          setNotifications(prev => prev.filter(n => n.id !== newNotification.id));
        }, 10000);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [userEmail]);

  // Sync from URL if it changes
  useEffect(() => {
    const q = searchParams.get('search') || '';
    if (q !== searchQuery) {
      setSearchQuery(q);
    }
  }, [searchParams]);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const transactions = useMemo(() => {
    return payments
      .filter(p => p.status === 'Paid' || p.status === 'Success' || p.status === 'Refunded' || p.status === 'Flagged' || p.status === 'Failed')
      .map(p => {
        const isExpired = p.creation_timestamp
          ? (Date.now() / 1000) > (p.creation_timestamp + 12 * 60)
          : false;

        let displayStatus = p.status;

        if (p.status === 'Paid' || p.status === 'Success') {
          displayStatus = 'Success';
        } else if (isExpired && p.status !== 'Paid' && p.status !== 'Success' && p.status !== 'Refunded' && p.status !== 'Flagged' && p.status !== 'Failed') {
          displayStatus = 'Expired';
        } else if (p.status === 'Active') {
          displayStatus = 'Pending';
        }

        return {
          id: p.id,
          customer: p.name,
          amount: p.amount,
          currency: p.currency,
          status: p.status,
          displayStatus: displayStatus,
          date: p.creation_timestamp
            ? new Date(p.creation_timestamp * 1000).toLocaleString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
            })
            : (p.created || ''),
          type: 'Payment',
          utr_id: p.utr_id,
          user_id: (p as any).user_id
        };
      })
      .sort((a, b) => {
        // Find original payment object to get timestamp
        const pA = payments.find(p => p.id === a.id);
        const pB = payments.find(p => p.id === b.id);
        return (pB?.creation_timestamp || 0) - (pA?.creation_timestamp || 0);
      })
  }, [payments]);

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(txn => {
        const matchesSearch =
          txn.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          txn.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (txn.user_id && txn.user_id.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesStatus = statusFilter === 'All' || txn.displayStatus === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .map((txn, index) => ({
        ...txn,
        sr: index + 1,
        date: txn.date.split(' by ')[0] // Clean up date
      }));
  }, [searchQuery, statusFilter, transactions]);

  const effectiveItemsPerPage = itemsPerPage === -1 ? filteredTransactions.length : itemsPerPage;
  const totalPages = Math.ceil(filteredTransactions.length / (effectiveItemsPerPage || 1));

  const paginatedTransactions = useMemo(() => {
    if (itemsPerPage === -1) return filteredTransactions;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTransactions, currentPage, itemsPerPage]);

  // Reset page when filters or itemsPerPage change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, itemsPerPage]);

  const handleExport = () => {
    if (!filteredTransactions || filteredTransactions.length === 0) {
      alert("No data to export");
      return;
    }
    const excludeFields = ['user_id'];
    let headers = Object.keys(filteredTransactions[0]).filter(key => !excludeFields.includes(key));

    // Move 'sr' to the first column
    if (headers.includes('sr')) {
      headers = ['sr', ...headers.filter(h => h !== 'sr')];
    }

    const csvRows = filteredTransactions.map(row =>
      headers.map(key => {
        const value = (row as any)[key];
        let strVal = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');

        if (strVal.trim() === '') {
          strVal = '-';
        }

        if (key === 'amount' && strVal !== '-') {
          strVal = strVal.replace(/[^0-9.-]/g, '');
        }

        if (key === 'utr_id' && strVal && strVal !== '-') {
          return `"=""${strVal.replace(/"/g, '""')}"""`;
        }

        return `"${strVal.replace(/"/g, '""')}"`;
      }).join(',')
    );
    const csvString = [headers.join(','), ...csvRows].join('\n');
    const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csvString);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "transactions_export.csv");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleAction = async (id: string, action: 'refund' | 'flag') => {
    setIsActionLoading(true);
    try {
      const res = await apiFetch(`/merchant/payments/${id}/${action}`, {
        method: 'POST'
      });
      if (res.ok) {
        await fetchPayments(false);
        setActiveMenu(null);
      }
    } catch (err) {
      console.error(`Failed to ${action}:`, err);
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 relative">

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-secondary tracking-tight">Transactions</h1>
          <p className="text-sm text-muted mt-1">View and manage your platform's financial activity.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
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
          <div className="relative flex-1 sm:flex-none">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full appearance-none flex items-center gap-2 px-4 py-2.5 bg-white border border-border rounded-lg text-xs md:text-sm font-bold text-secondary hover:bg-slate-50 transition-colors pr-10 cursor-pointer shadow-sm"
            >
              <option value="All">All Statuses</option>
              <option value="Success">Success</option>
              <option value="Pending">Pending</option>
              <option value="Expired">Expired</option>
              <option value="Failed">Failed</option>
            </select>
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          </div>
          <button
            onClick={handleExport}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-border rounded-lg text-xs md:text-sm font-bold text-secondary hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      <div className="premium-card rounded-xl min-h-[400px]">
        <div className="px-4 md:px-6 py-4 border-b border-border bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative w-full md:w-64 group">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 transition-colors ${searchQuery ? 'text-primary' : 'text-muted'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ID or customer..."
              className="w-full pl-9 pr-9 py-1.5 bg-white border border-border rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-primary transition-all group-hover:border-primary/30"
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
              Showing {filteredTransactions.length === 0 ? 0 : (itemsPerPage === -1 ? 1 : (currentPage - 1) * itemsPerPage + 1)}-{itemsPerPage === -1 ? filteredTransactions.length : Math.min(filteredTransactions.length, currentPage * itemsPerPage)} of {filteredTransactions.length} results
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Loading transactions...</p>
          </div>
        ) : connectionError && payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-6">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-2">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-secondary">Backend Connection Failed</p>
              <p className="text-xs text-muted max-w-[280px] mt-1">We couldn't reach the server to fetch transactions.</p>
            </div>
            <button
              onClick={() => fetchPayments()}
              className="px-6 py-2 bg-secondary text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all"
            >
              Retry Connection
            </button>
          </div>
        ) : (
          <div className="overflow-visible min-h-[500px]">
            {/* Desktop Table View */}
            <table className="w-full high-density-table text-left hidden md:table">
              <thead>
                <tr>
                  <th className="w-12">SR.</th>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>UTR ID</th>
                  <th className="text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransactions.map((txn, index) => (
                  <tr key={`${txn.id}-${index}`} className={`hover:bg-slate-50 transition-colors relative group ${activeMenu === txn.id ? 'z-[60]' : 'z-auto'}`}>
                    <td className="text-xs font-bold text-muted">{(txn as any).sr}</td>
                    <td className="font-mono text-[10px] text-muted">{txn.id}</td>
                    <td className="font-bold text-secondary text-sm">{txn.customer}</td>
                    <td className="text-[10px] font-bold text-muted uppercase tracking-wider">{txn.type}</td>
                    <td className="font-bold text-secondary text-sm">{txn.amount} <span className="text-[10px] text-muted font-normal ml-0.5">{txn.currency}</span></td>
                    <td>
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${txn.displayStatus === 'Success' ? 'bg-green-50 text-green-600 border-green-100' :
                        txn.displayStatus === 'Active' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                          txn.displayStatus === 'Pending' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
                            (txn.displayStatus === 'Expired' || txn.displayStatus === 'Failed') ? 'bg-red-50 text-red-600 border-red-100' :
                              txn.displayStatus === 'Refunded' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                txn.displayStatus === 'Flagged' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                                  'bg-slate-50 text-slate-500 border-slate-100'
                        }`}>
                        {txn.displayStatus}
                      </span>
                    </td>
                    <td className="text-[10px] font-mono text-muted">{txn.utr_id || '-'}</td>
                    <td className="text-[10px] text-muted text-right">{txn.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile Card List View */}
            <div className="md:hidden divide-y divide-border">
              {paginatedTransactions.map((txn, index) => (
                <div key={`mob-${txn.id}-${index}`} className="p-4 space-y-4 hover:bg-slate-50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-muted uppercase">#{(txn as any).sr}</span>
                        <span className="font-mono text-[10px] text-muted">{txn.id}</span>
                      </div>
                      <h4 className="font-bold text-secondary">{txn.customer}</h4>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${txn.displayStatus === 'Success' ? 'bg-green-50 text-green-600 border-green-100' :
                        txn.displayStatus === 'Active' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                          txn.displayStatus === 'Pending' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
                            (txn.displayStatus === 'Expired' || txn.displayStatus === 'Failed') ? 'bg-red-50 text-red-600 border-red-100' :
                              txn.displayStatus === 'Refunded' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                txn.displayStatus === 'Flagged' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                                  'bg-slate-50 text-slate-500 border-slate-100'
                        }`}>
                        {txn.displayStatus}
                      </span>
                      <div className="text-right">
                        <p className="text-sm font-bold text-secondary">{txn.amount} {txn.currency}</p>
                        <p className="text-[10px] text-muted">{txn.date}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-muted uppercase">UTR ID</span>
                      <span className="font-mono text-[10px] text-secondary">{txn.utr_id || '-'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {paginatedTransactions.length === 0 && (
              <div className="py-20 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-sm font-bold text-secondary">No transactions found</p>
                <p className="text-xs text-muted mt-1">Try adjusting your filters or search query.</p>
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
      {/* Transaction Details Modal */}
      {selectedTxn && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedTxn(null)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-secondary">Transaction Details</h3>
              <button onClick={() => setSelectedTxn(null)} className="p-1 hover:bg-slate-200 rounded-full">
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted uppercase">Transaction ID</p>
                  <p className="font-mono text-sm text-secondary">{selectedTxn.id}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted uppercase">Status</p>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${selectedTxn.status === 'Paid' || selectedTxn.status === 'Success' ? 'bg-green-50 text-green-600 border-green-100' :
                    selectedTxn.status === 'Active' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                      selectedTxn.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        selectedTxn.status === 'Refunded' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                          selectedTxn.status === 'Flagged' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                            'bg-slate-50 text-slate-500 border-slate-100'
                    }`}>
                    {selectedTxn.status}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted uppercase">Customer Name</p>
                  <p className="text-sm font-bold text-secondary">{selectedTxn.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted uppercase">Amount</p>
                  <p className="text-sm font-bold text-secondary">{selectedTxn.amount} {selectedTxn.currency}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted uppercase">Date</p>
                  <p className="text-sm text-secondary">{selectedTxn.created}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted uppercase">UTR ID</p>
                  <p className="font-mono text-sm text-secondary">{selectedTxn.utr_id || 'Not Verified'}</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-border flex justify-end">
              <button
                onClick={() => setSelectedTxn(null)}
                className="px-6 py-2 bg-secondary text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
