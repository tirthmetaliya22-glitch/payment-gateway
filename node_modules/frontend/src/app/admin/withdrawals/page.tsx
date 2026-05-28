"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  User,
  CreditCard,
  X,
  RefreshCcw
} from 'lucide-react';
import { API_URL, apiFetch } from '@/lib/api';

interface Withdrawal {
  id: string;
  email: string;
  amount: number | string;
  status: string;
  bank: string;
  ifsc?: string;
  created_at: string;
  user_id?: string;
  type?: string;
}

function ProcessWithdrawalModal({ isOpen, onClose, onSuccess }: { isOpen: boolean, onClose: () => void, onSuccess: (withdrawal?: any) => void }) {
  const [formData, setFormData] = useState({
    merchant_identifier: '',
    amount: '',
    bank_account: '',
    ifsc_code: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [merchants, setMerchants] = useState<any[]>([]);
  const [isFetchingMerchants, setIsFetchingMerchants] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const fetchMerchants = async () => {
        setIsFetchingMerchants(true);
        try {
          const res = await apiFetch('/admin/merchants');
          if (res.ok) {
            const data = await res.json();
            setMerchants(data);
          }
        } catch (err) {
          console.error("Failed to fetch merchants", err);
        } finally {
          setIsFetchingMerchants(false);
        }
      };
      fetchMerchants();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await apiFetch('/admin/withdraw', {
        method: 'POST',
        body: JSON.stringify({
          merchant_identifier: formData.merchant_identifier,
          amount: parseFloat(formData.amount),
          bank_account: formData.bank_account,
          ifsc_code: formData.ifsc_code
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to process withdrawal');
      }

      const data = await response.json();

      const newWithdrawal = {
        id: `WD-${Date.now().toString().slice(-8)}`,
        email: formData.merchant_identifier,
        amount: parseFloat(formData.amount),
        status: 'SUCCESS',
        bank: formData.bank_account.length >= 4 ? `Account (****${formData.bank_account.slice(-4)})` : formData.bank_account,
        ifsc: formData.ifsc_code,
        created_at: new Date().toISOString(),
        type: 'withdrawal'
      };

      onSuccess(newWithdrawal);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] sm:max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-4 sm:zoom-in duration-500 sm:duration-300">
        <div className="px-6 py-4 border-b border-border bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-secondary">Process Withdrawal</h3>
            <p className="text-[10px] text-muted font-bold uppercase tracking-wider">
              Deduct funds and initiate payout
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors">
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-red-600 text-xs font-bold">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Merchant</label>
            <div className="relative">
              <select
                required
                value={formData.merchant_identifier}
                onChange={e => setFormData({ ...formData, merchant_identifier: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none cursor-pointer disabled:opacity-50"
                disabled={isFetchingMerchants}
              >
                <option value="" disabled>
                  {isFetchingMerchants ? "Loading merchants..." : "Select a merchant"}
                </option>
                {merchants.map((m, i) => (
                  <option key={i} value={m.email || m.username || m.merchant_id}>
                    {m.name || 'Unnamed'} ({m.email || m.username || m.merchant_id})
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none">
                {isFetchingMerchants ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted" />
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Amount (₹)</label>
            <input
              required
              type="number"
              min="1"
              step="any"
              placeholder="0.00"
              value={formData.amount}
              onChange={e => setFormData({ ...formData, amount: e.target.value })}
              onWheel={e => (e.target as HTMLElement).blur()}
              className="w-full px-4 py-2.5 bg-slate-50 border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Bank Account Number</label>
            <input
              required
              type="text"
              placeholder="e.g., 000000000000"
              value={formData.bank_account}
              onChange={e => setFormData({ ...formData, bank_account: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider">IFSC Code</label>
            <input
              required
              type="text"
              placeholder="e.g., HDFC0000001"
              value={formData.ifsc_code}
              onChange={e => setFormData({ ...formData, ifsc_code: e.target.value.toUpperCase() })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all uppercase"
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-border rounded-xl text-xs font-bold text-secondary hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              disabled={isSubmitting}
              className="flex-1 py-3 bg-primary text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Process
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const syncStatuses = async () => {
    setIsSyncing(true);
    try {
      const res = await apiFetch('/admin/withdrawals/sync-status', { method: 'POST' });
      if (res.ok) {
        await fetchWithdrawals(true);
      }
    } catch (e) {
      console.error("Failed to sync", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchWithdrawals = async (silent = false) => {
    if (!silent) setIsLoading(true);
    setConnectionError(false);
    try {
      const res = await apiFetch(`/admin/withdrawals?_t=${Date.now()}`);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setWithdrawals(data);
      } else {
        setWithdrawals([]);
      }
    } catch (err: any) {
      if (!silent) setConnectionError(true);
      if (!silent) setWithdrawals([]);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const filteredWithdrawals = useMemo(() => {
    return withdrawals.filter(w => {
      const query = searchQuery.toLowerCase();
      return (
        w.id.toLowerCase().includes(query) ||
        (w.email && w.email.toLowerCase().includes(query)) ||
        (w.bank && w.bank.toLowerCase().includes(query)) ||
        (w.status && w.status.toLowerCase().includes(query))
      );
    });
  }, [searchQuery, withdrawals]);

  const effectiveItemsPerPage = itemsPerPage === -1 ? filteredWithdrawals.length : itemsPerPage;
  const totalPages = Math.ceil(filteredWithdrawals.length / (effectiveItemsPerPage || 1));

  const paginatedWithdrawals = useMemo(() => {
    if (itemsPerPage === -1) return filteredWithdrawals;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredWithdrawals.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredWithdrawals, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full animate-in fade-in duration-500">
      <ProcessWithdrawalModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={(newW) => {
          if (newW) setWithdrawals(prev => [newW, ...prev]);
          fetchWithdrawals(true);
        }}
      />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-secondary tracking-tight">Withdrawals</h1>
          <p className="text-sm text-muted mt-1 font-medium">Monitor all merchant withdrawals across the platform.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-emerald-600 transition-all shadow-md shadow-emerald-100"
          >
            PROCESS WITHDRAWAL
          </button>
          <button
            onClick={syncStatuses}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-700 transition-all shadow-md disabled:opacity-50"
          >
            {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
            SYNC STATUS
          </button>
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

      <div className="premium-card rounded-xl overflow-hidden min-h-[400px]">
        <div className="px-4 md:px-6 py-4 border-b border-border bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative w-full md:w-64 group">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 transition-colors ${searchQuery ? 'text-primary' : 'text-muted'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by email, bank, ID..."
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
              Showing {filteredWithdrawals.length === 0 ? 0 : (itemsPerPage === -1 ? 1 : (currentPage - 1) * itemsPerPage + 1)}-{itemsPerPage === -1 ? filteredWithdrawals.length : Math.min(filteredWithdrawals.length, currentPage * itemsPerPage)} of {filteredWithdrawals.length} withdrawals
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Fetching global withdrawals...</p>
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
              onClick={() => fetchWithdrawals()}
              className="px-6 py-2 bg-secondary text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all shadow-md"
            >
              Retry Connection
            </button>
          </div>
        ) : (
          <>
            {/* Mobile View */}
            <div className="block md:hidden border-t border-border">
              <div className="divide-y divide-slate-100">
                {paginatedWithdrawals.map((w, index) => (
                  <div key={`${w.id}-${index}`} className="p-4 bg-white hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <div className="min-w-0 flex flex-col gap-1">
                        <span className="font-bold text-secondary text-sm flex items-center gap-1.5 truncate">
                          <User className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="truncate">{w.email || 'N/A'}</span>
                        </span>
                        <span className="font-mono text-[10px] text-muted">{w.id}</span>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold border ${w.status === 'Completed' || w.status === 'Success' ? 'bg-green-50 text-green-600 border-green-100' :
                        w.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                          w.status === 'Failed' ? 'bg-red-50 text-red-600 border-red-100' :
                            'bg-slate-50 text-slate-500 border-slate-100'
                        }`}>
                        {w.status || 'Pending'}
                      </span>
                    </div>
                    <div className="flex justify-between items-end mt-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-secondary text-xs">{w.bank || '-'}</span>
                        {w.ifsc && <span className="text-[10px] text-muted">IFSC: {w.ifsc}</span>}
                        <span className="text-[10px] text-muted mt-1">
                          {w.created_at ? new Date(w.created_at).toLocaleString() : 'N/A'}
                        </span>
                      </div>
                      <span className="font-black text-secondary text-sm">
                        ₹{typeof w.amount === 'number' ? w.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : w.amount}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {paginatedWithdrawals.length === 0 && (
                <div className="py-12 text-center">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CreditCard className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-sm font-bold text-secondary">No withdrawals found</p>
                  <p className="text-xs text-muted mt-1">Global withdrawal history will appear here.</p>
                </div>
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto border-t border-border">
              <table className="w-full high-density-table text-left">
                <thead>
                  <tr className="bg-slate-50/30">
                    <th className="w-12">SR.</th>
                    <th>ID</th>
                    <th>Merchant Email</th>
                    <th>Bank Info</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedWithdrawals.map((w, index) => (
                    <tr key={`${w.id}-${index}`} className="hover:bg-slate-50 transition-colors align-middle group">
                      <td className="text-xs font-bold text-muted py-4">
                        {itemsPerPage === -1 ? index + 1 : (currentPage - 1) * itemsPerPage + index + 1}
                      </td>
                      <td className="font-mono text-[10px] text-muted py-4">{w.id}</td>
                      <td className="py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-secondary text-xs flex items-center gap-1.5">
                            <User className="w-3 h-3 text-primary" /> {w.email || 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-secondary text-xs">{w.bank || '-'}</span>
                          {w.ifsc && <span className="text-[10px] text-muted">IFSC: {w.ifsc}</span>}
                        </div>
                      </td>
                      <td className="py-4 font-bold text-secondary text-xs">
                        ₹{typeof w.amount === 'number' ? w.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : w.amount}
                      </td>
                      <td className="py-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${w.status === 'Completed' || w.status === 'Success' ? 'bg-green-50 text-green-600 border-green-100' :
                          w.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                            w.status === 'Failed' ? 'bg-red-50 text-red-600 border-red-100' :
                              'bg-slate-50 text-slate-500 border-slate-100'
                          }`}>
                          {w.status || 'Pending'}
                        </span>
                      </td>
                      <td className="text-[10px] text-muted py-4">
                        {w.created_at ? new Date(w.created_at).toLocaleString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {paginatedWithdrawals.length === 0 && (
                <div className="py-20 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CreditCard className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-sm font-bold text-secondary">No withdrawals found</p>
                  <p className="text-xs text-muted mt-1">Global withdrawal history will appear here.</p>
                </div>
              )}
            </div>
          </>
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
                        className={`w-8 h-8 md:w-10 md:h-10 rounded-md flex items-center justify-center text-xs font-bold transition-all ${currentPage === page
                          ? 'bg-primary text-white shadow-md'
                          : 'text-muted hover:text-secondary hover:bg-slate-50'
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
                disabled={currentPage === totalPages || isLoading}
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
