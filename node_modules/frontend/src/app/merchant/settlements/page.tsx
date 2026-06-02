'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  RotateCcw,
  Download,
  Filter,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Calendar,
  Wallet,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RefreshCcw as RefreshCcwIcon
} from 'lucide-react';
import { apiFetch, API_URL } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';

export default function SettlementsPage() {
  const { userEmail, isLoggedIn } = useAuth();
  const [settlements, setSettlements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);

  // Pagination & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Withdrawal Modal State
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [withdrawalType, setWithdrawalType] = useState<'bank_transfer' | 'self_withdrawal'>('bank_transfer');
  const [remarks, setRemarks] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState('');
  const [userId, setUserId] = useState('');
  const [merchantsList, setMerchantsList] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const syncStatuses = async () => {
    setIsSyncing(true);
    try {
      const res = await apiFetch('/merchant/withdrawals/sync-status', { method: 'POST' });
      if (res.ok) {
        await fetchData();
      }
    } catch (e) {
      console.error("Failed to sync", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchData = async () => {
    try {
      setError(null);

      // Fetch profile to get real wallet balance
      const profileRes = await apiFetch(`/merchant/profile?_t=${Date.now()}`);
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setWalletBalance(Number(profileData.wallet_balance) || 0);
      }

      const res = await apiFetch(`/merchant/settlements?_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setSettlements(data || []);
      } else {
        setSettlements([]);
      }
    } catch (err) {
      console.warn("Could not fetch settlements, using empty array.");
      setSettlements([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Fetch merchants for the dropdown and set logged-in user as default
    const fetchMerchants = async () => {
      try {
        let loggedInProf: any = null;

        const profRes = await apiFetch('/merchant/profile');
        if (profRes.ok) {
          loggedInProf = await profRes.json();
          setUserId(loggedInProf.user_id || loggedInProf.id || loggedInProf._id || loggedInProf.merchant_id);
        }

        const res = await apiFetch('/admin/merchants');
        if (res.ok) {
          const data = await res.json();
          setMerchantsList(data || []);
        } else if (loggedInProf) {
          setMerchantsList([loggedInProf]);
        }
      } catch (err) {
        console.error("Failed to fetch merchants:", err);
      }
    };
    fetchMerchants();
  }, []);

  useEffect(() => {
    if (!isLoggedIn || !API_URL || !userEmail) return;

    const handleUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const data = customEvent.detail;

      if (data && data.type === 'WALLET_UPDATED' && data.email === userEmail) {
        setWalletBalance(data.balance || data.wallet_balance || 0);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('realtime_update', handleUpdate);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('realtime_update', handleUpdate);
      }
    };
  }, [isLoggedIn, userEmail]);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError('');
    setWithdrawSuccess('');

    const amountNum = parseFloat(withdrawAmount);
    if (!amountNum || amountNum <= 0) {
      setWithdrawError('Enter a valid amount');
      return;
    }
    if (amountNum > walletBalance) {
      setWithdrawError('Insufficient available balance');
      return;
    }
    
    if (withdrawalType === 'bank_transfer') {
      if (!bankAccount || bankAccount.length < 8) {
        setWithdrawError('Enter a valid bank account number');
        return;
      }
      if (!ifscCode || ifscCode.length < 4) {
        setWithdrawError('Enter a valid IFSC code');
        return;
      }
    }

    setIsWithdrawing(true);
    try {
      const payload: any = {
        amount: amountNum,
        type: withdrawalType,
        user_id: userId
      };
      
      if (withdrawalType === 'bank_transfer') {
        payload.bank_account = bankAccount;
        payload.ifsc_code = ifscCode;
      } else {
        payload.remarks = remarks;
      }

      const res = await apiFetch('/merchant/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        setWithdrawSuccess('Withdrawal request initiated successfully!');
        setWalletBalance(data.new_balance || (walletBalance - amountNum));

        // Optimistically add the new withdrawal to the local state so it appears instantly without refresh
        const newWithdrawal = {
          id: `WD-${Date.now().toString().slice(-8)}`,
          amount: `₹${amountNum.toFixed(2)}`,
          status: 'SUCCESS',
          bank: withdrawalType === 'self_withdrawal' ? 'Registered Business Account' : (bankAccount.length >= 4 ? `Account (****${bankAccount.slice(-4)})` : bankAccount),
          date: new Date().toISOString(),
          created_at: new Date().toISOString(),
          email: userEmail || '',
          type: withdrawalType
        };
        setSettlements(prev => [newWithdrawal, ...prev]);

        setWithdrawAmount('');
        setBankAccount('');
        setIfscCode('');
        setRemarks('');
        setWithdrawalType('bank_transfer');

        // Refresh settlements list to ensure sync with backend
        fetchData();

        setTimeout(() => {
          setIsWithdrawModalOpen(false);
          setWithdrawSuccess('');
        }, 2000);
      } else {
        setWithdrawError(data.detail || 'Withdrawal failed. Please try again.');
      }
    } catch (err) {
      setWithdrawError('Network error. Please try again later.');
    } finally {
      setIsWithdrawing(false);
    }
  };

  const exportToCSV = () => {
    if (settlements.length === 0) return;

    const headers = ["Settlement ID", "Date", "Amount", "Status", "Bank / UTR"];
    const rows = settlements.map(s => [
      `"${s.id || ''}"`,
      `"${(s.created_at || s.date) ? new Date(s.created_at || s.date).toLocaleDateString() : 'N/A'}"`,
      `"${typeof s.amount === 'number' ? s.amount.toFixed(2) : s.amount}"`,
      `"${s.status || ''}"`,
      `"${s.bank || s.utr || '-'}"`
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `settlements_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredSettlements = useMemo(() => {
    if (!searchQuery) return settlements;
    const lowerQuery = searchQuery.toLowerCase();
    return settlements.filter(s =>
      (s.id && s.id.toLowerCase().includes(lowerQuery)) ||
      (s.status && s.status.toLowerCase().includes(lowerQuery)) ||
      (s.bank && s.bank.toLowerCase().includes(lowerQuery)) ||
      (s.utr && s.utr.toLowerCase().includes(lowerQuery))
    );
  }, [settlements, searchQuery]);

  const effectiveItemsPerPage = itemsPerPage === -1 ? filteredSettlements.length : itemsPerPage;
  const totalPages = Math.ceil(filteredSettlements.length / (effectiveItemsPerPage || 1));

  const paginatedSettlements = useMemo(() => {
    if (itemsPerPage === -1) return filteredSettlements;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredSettlements.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSettlements, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted">Loading settlements...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-secondary tracking-tight">Settlements</h1>
          <p className="text-sm text-muted mt-1">Track your payouts and settlement history.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={syncStatuses}
            disabled={isSyncing}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 border border-transparent rounded-lg text-sm font-bold text-white hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcwIcon className="w-4 h-4" />} Sync Status
          </button>
          <button
            onClick={() => setIsWithdrawModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-primary border border-transparent rounded-lg text-sm font-bold text-white hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Wallet className="w-4 h-4" /> Withdraw Funds
          </button>
          <button
            onClick={exportToCSV}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-border rounded-lg text-sm font-bold text-secondary hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="premium-card p-6 rounded-xl border-l-4 border-l-blue-500">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-4 h-4 text-blue-500" />
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Available Balance</p>
          </div>
          <h3 className="text-2xl font-bold text-secondary">₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
          <p className="text-[10px] font-medium text-muted mt-1">Ready for withdrawal via Cashfree Payouts</p>
        </div>
        <div className="premium-card p-6 rounded-xl border-l-4 border-l-green-500">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Last Settled</p>
          </div>
          <h3 className="text-2xl font-bold text-secondary">₹0.00</h3>
          <p className="text-[10px] font-medium text-muted mt-1">No previous settlements</p>
        </div>
      </div>

      <div className="premium-card rounded-xl overflow-hidden min-h-[400px]">
        <div className="px-6 py-4 border-b border-border bg-slate-50/50 flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="Search settlements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-border rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-primary transition-all"
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
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-white border border-border px-3 py-1.5 rounded-md shadow-sm">
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
            <button className="flex items-center gap-2 px-3 py-2 bg-white border border-border rounded-md text-xs font-bold text-secondary hover:bg-slate-50 transition-colors">
              <Filter className="w-3.5 h-3.5" /> Filter
            </button>
          </div>
        </div>

        {filteredSettlements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <RotateCcw className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-sm font-bold text-secondary">{searchQuery ? "No matching settlements" : "No settlements yet"}</h3>
            <p className="text-xs text-muted mt-1 max-w-sm">{searchQuery ? "Try adjusting your search filters." : "Your settlement history will appear here once your transactions are processed and paid out."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-bold text-muted uppercase tracking-wider">
                  <th className="p-4 border-b border-border w-12">SR.</th>
                  <th className="p-4 border-b border-border">Settlement ID</th>
                  <th className="p-4 border-b border-border">Date</th>
                  <th className="p-4 border-b border-border">Amount</th>
                  <th className="p-4 border-b border-border">Status</th>
                  <th className="p-4 border-b border-border">Bank / UTR</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSettlements.map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors text-sm border-b border-border/50 last:border-0">
                    <td className="p-4 text-xs font-bold text-muted">
                      {itemsPerPage === -1 ? idx + 1 : (currentPage - 1) * itemsPerPage + idx + 1}
                    </td>
                    <td className="p-4 font-mono text-xs text-muted">{s.id}</td>
                    <td className="p-4 text-secondary">{(s.created_at || s.date) ? new Date(s.created_at || s.date).toLocaleDateString() : 'N/A'}</td>
                    <td className="p-4 font-bold text-secondary">
                      {typeof s.amount === 'number' ? `₹${s.amount.toFixed(2)}` : s.amount}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${s.status === 'Completed' || s.status === 'SUCCESS' ? 'bg-green-50 text-green-600 border-green-100' :
                        'bg-blue-50 text-blue-600 border-blue-100'
                        }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-xs text-muted">{s.bank || s.utr || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      {/* Withdrawal Modal */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-secondary">Withdraw Funds</h3>
              </div>
              <button
                onClick={() => setIsWithdrawModalOpen(false)}
                className="p-1 text-muted hover:text-secondary rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleWithdraw} className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
              <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl flex justify-between items-center">
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">Available Balance</span>
                <span className="text-lg font-bold text-primary">
                  ₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {withdrawError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 text-red-600 text-xs">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>{withdrawError}</p>
                </div>
              )}
              {withdrawSuccess && (
                <div className="p-3 bg-green-50 border border-green-100 rounded-lg flex items-start gap-2 text-green-600 text-xs font-medium">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>{withdrawSuccess}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
                    Amount to Withdraw
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-bold">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      className="w-full pl-8 pr-16 py-2.5 bg-white border border-border rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
                    Merchant
                  </label>
                  {(() => {
                    const selected = merchantsList.find(m => (m.user_id || m.id || m._id || m.merchant_id) === userId);
                    return (
                      <div className="w-full px-3 py-2.5 bg-slate-50 border border-border rounded-lg text-sm text-secondary font-medium cursor-not-allowed opacity-90">
                        {selected ? `${selected.name || selected.username || 'Unknown'} (${selected.email})` : 'Loading merchant details...'}
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
                    Withdrawal Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setWithdrawalType("bank_transfer")}
                      className={`py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg border-2 transition-all ${withdrawalType === "bank_transfer" ? 'bg-primary border-primary text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                    >
                      Bank Account
                    </button>
                    <button
                      type="button"
                      onClick={() => setWithdrawalType("self_withdrawal")}
                      className={`py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg border-2 transition-all ${withdrawalType === "self_withdrawal" ? 'bg-primary border-primary text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                    >
                      Self Withdrawal
                    </button>
                  </div>
                </div>

                {withdrawalType === 'bank_transfer' ? (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
                        Bank Account Number
                      </label>
                      <input
                        type="text"
                        placeholder="Enter 8-18 digit account number"
                        value={bankAccount}
                        onChange={(e) => setBankAccount(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
                        IFSC Code
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. HDFC0001234"
                        value={ifscCode}
                        onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2.5 bg-white border border-border rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        maxLength={11}
                        required
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
                      Remarks (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Self withdrawal to business account"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isWithdrawing || walletBalance <= 0}
                className="w-full py-2.5 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-white rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
              >
                {isWithdrawing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                ) : (
                  'Confirm Withdrawal'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
