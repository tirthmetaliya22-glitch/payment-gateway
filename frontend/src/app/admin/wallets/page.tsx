"use client";

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Search, Plus, Wallet, RefreshCw, X } from 'lucide-react';

export default function WalletsPage() {
  const [merchants, setMerchants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMerchant, setSelectedMerchant] = useState<any | null>(null);
  const [amountToAdd, setAmountToAdd] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch('/admin/merchants');
      if (res.ok) {
        const data = await res.json();
        setMerchants(data);
      }
    } catch (err) {
      console.error("Failed to fetch merchants for wallets:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (merchant: any) => {
    setSelectedMerchant(merchant);
    setAmountToAdd('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedMerchant(null);
    setAmountToAdd('');
  };

  const handleAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMerchant || !amountToAdd || isNaN(Number(amountToAdd)) || Number(amountToAdd) <= 0) return;

    setIsSubmitting(true);
    try {
      const res = await apiFetch(`/admin/merchants/${selectedMerchant.merchant_id}/wallet/add`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(amountToAdd) }),
      });

      if (res.ok) {
        // Refresh data
        await fetchData();
        handleCloseModal();
      } else {
        const errorData = await res.json();
        alert(`Error: ${errorData.detail || 'Failed to add funds'}`);
      }
    } catch (err) {
      console.error("Failed to add funds:", err);
      alert("Network error while adding funds.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredMerchants = merchants.filter(m =>
    (m.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (m.email?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (m.merchant_id?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-secondary tracking-tight">Merchant Wallets</h1>
          <p className="text-sm text-muted mt-1 font-medium">Manage merchant balances and add funds</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-border rounded-xl text-sm font-bold text-secondary shadow-sm hover:shadow-md hover:bg-slate-50 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-primary' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="p-4 border-b border-border bg-slate-50/50 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="Search merchants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Mobile View */}
        <div className="block md:hidden border-t border-border">
          {isLoading ? (
            <div className="px-6 py-12 text-center text-muted">
              <div className="flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                <p className="font-medium text-xs">Loading merchants...</p>
              </div>
            </div>
          ) : filteredMerchants.length === 0 ? (
            <div className="px-6 py-12 text-center text-muted">
              <div className="flex flex-col items-center justify-center gap-2">
                <Wallet className="w-8 h-8 text-slate-300" />
                <p className="font-medium">No merchants found.</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredMerchants.map((merchant) => (
                <div key={merchant.merchant_id} className="p-4 bg-white hover:bg-slate-50 transition-colors">
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shadow-inner shrink-0">
                        {merchant.name?.charAt(0).toUpperCase() || 'M'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-secondary text-sm truncate">{merchant.name || 'Unknown'}</p>
                        <p className="text-xs text-muted font-mono bg-slate-100 inline-block px-1.5 py-0.5 rounded mt-0.5 truncate max-w-full">{merchant.merchant_id}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm text-secondary font-medium truncate pr-2">{merchant.email}</span>
                    <span className="text-lg font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100 shrink-0">
                      ₹{(Number(merchant.wallet_balance) || 0).toFixed(2)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleOpenModal(merchant)}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-all shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    Add Funds
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto border-t border-border">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-border text-xs font-bold text-muted uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Merchant</th>
                <th className="px-6 py-4 font-semibold">Contact Info</th>
                <th className="px-6 py-4 font-semibold text-right">Current Balance</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                      <p className="font-medium text-xs">Loading merchants...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredMerchants.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Wallet className="w-8 h-8 text-slate-300" />
                      <p className="font-medium">No merchants found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredMerchants.map((merchant) => (
                  <tr key={merchant.merchant_id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shadow-inner">
                          {merchant.name?.charAt(0).toUpperCase() || 'M'}
                        </div>
                        <div>
                          <p className="font-bold text-secondary text-sm">{merchant.name || 'Unknown'}</p>
                          <p className="text-xs text-muted font-mono bg-slate-100 inline-block px-1.5 py-0.5 rounded mt-0.5">{merchant.merchant_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-secondary font-medium">{merchant.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-lg font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">
                        ₹{(Number(merchant.wallet_balance) || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleOpenModal(merchant)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all shadow-md"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Funds
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Funds Modal */}
      {isModalOpen && selectedMerchant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-border flex justify-between items-center bg-slate-50/50">
              <h2 className="text-lg font-bold text-secondary flex items-center gap-2">
                <Wallet className="w-5 h-5 text-primary" /> Add Funds to Wallet
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-1.5 text-muted hover:text-secondary hover:bg-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddFunds} className="p-6">
              <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-border">
                <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Merchant Details</p>
                <p className="text-sm font-bold text-secondary">{selectedMerchant.name}</p>
                <p className="text-xs text-muted font-mono mt-0.5">{selectedMerchant.merchant_id}</p>
                <div className="mt-3 flex justify-between items-end">
                  <span className="text-xs font-medium text-muted">Current Balance</span>
                  <span className="text-sm font-black text-emerald-600">
                    ₹{(Number(selectedMerchant.wallet_balance) || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 animate-in fade-in duration-200">
                <label className="text-[10px] font-bold text-muted uppercase tracking-widest pl-1">Amount to Add</label>
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-muted group-focus-within:text-primary transition-colors">₹</div>
                  <input
                    type="number"
                    value={amountToAdd}
                    onChange={(e) => setAmountToAdd(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all"
                    placeholder="0.00"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 py-2.5 bg-slate-100 text-secondary rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !amountToAdd || Number(amountToAdd) <= 0}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-200 hover:bg-emerald-700 hover:shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {isSubmitting ? 'Processing...' : 'Add Funds'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
