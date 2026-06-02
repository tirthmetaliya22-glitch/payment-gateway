"use client";

import React, { useState, useEffect } from 'react';
import { apiFetch, API_URL } from '@/lib/api';
import { useAuth } from '../../../components/AuthProvider';
import { Wallet, RefreshCw, ArrowDownLeft, Calendar, FileText } from 'lucide-react';

export default function MerchantWalletPage() {
  const [balance, setBalance] = useState<number>(0);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isLoggedIn, userEmail } = useAuth();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch balance from profile
      const profileRes = await apiFetch('/merchant/profile');
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setBalance(Number(profileData.wallet_balance) || 0);
      }

      // Fetch history
      const historyRes = await apiFetch('/merchant/wallet/history');
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setHistory(historyData);
      }
    } catch (err) {
      console.error("Failed to fetch wallet data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!isLoggedIn || !API_URL) return;

    const { io } = require('socket.io-client');
    const socket = io(API_URL);

    socket.on('connect_error', (error: any) => {
      console.warn('[Wallet] Socket connection error:', error);
    });

    socket.on('payment_update', (data: any) => {
      if (data.type === 'WALLET_UPDATED' && data.email === userEmail) {
        // Automatically refresh data when funds are added
        fetchData();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [isLoggedIn, userEmail]);

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto w-full animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-secondary tracking-tight">My Wallet</h1>
          <p className="text-sm text-muted mt-1 font-medium">View your current balance and transaction history</p>
        </div>
        <button
          onClick={fetchData}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-border rounded-xl text-sm font-bold text-secondary shadow-sm hover:shadow-md hover:bg-slate-50 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-primary' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Balance Card */}
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-3xl p-8 mb-8 shadow-xl shadow-emerald-900/20 text-white relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-emerald-400/20 rounded-full blur-3xl"></div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <div className="flex items-center gap-2 text-emerald-100 mb-2">
              <Wallet className="w-5 h-5" />
              <span className="text-sm font-bold uppercase tracking-wider">Available Balance</span>
            </div>
            <div className="text-5xl font-black tracking-tight">
              ₹{balance.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-border bg-slate-50/50 flex justify-between items-center">
          <h2 className="text-lg font-bold text-secondary flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" /> Wallet History
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-border text-xs font-bold text-muted uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Date & Time</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 font-semibold">Description</th>
                <th className="px-6 py-4 font-semibold text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {isLoading && history.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                      <p className="font-medium text-xs">Loading history...</p>
                    </div>
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Wallet className="w-8 h-8 text-slate-300" />
                      <p className="font-medium">No transactions found.</p>
                      <p className="text-xs">Your wallet history will appear here.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                history.map((entry) => (
                  <tr key={entry._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-secondary">
                        <Calendar className="w-4 h-4 text-muted" />
                        <span>{new Date(entry.timestamp).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold ${entry.type === 'CREDIT' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}>
                        {entry.type === 'CREDIT' ? <ArrowDownLeft className="w-3.5 h-3.5" /> : null}
                        {entry.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-secondary font-medium">{entry.description}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={`font-black ${entry.type === 'CREDIT' ? 'text-emerald-600' : 'text-secondary'}`}>
                        {entry.type === 'CREDIT' ? '+' : '-'}₹{Number(entry.amount).toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
