'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LifeBuoy, 
  Search, 
  Plus, 
  Clock, 
  CheckCircle2, 
  MessageSquare,
  User,
  ChevronRight,
  Loader2,
  X,
  Send,
  AlertTriangle,
  History
} from 'lucide-react';
import { API_URL } from '@/lib/api';

export default function SupportQueuePage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setError(null);
      const [ticketsRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/admin/tickets`),
        fetch(`${API_URL}/admin/stats`)
      ]);
      
      if (!ticketsRes.ok || !statsRes.ok) {
        throw new Error('Failed to fetch support data');
      }

      const ticketsData = await ticketsRes.json();
      const statsData = await statsRes.json();
      
      setTickets(ticketsData);
      setStats(statsData);
    } catch (err) {
      console.error("Failed to fetch support data:", err);
      setError("Unable to connect to the backend server.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchesSearch = 
        (t.subject || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.merchant || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesTab = activeTab === 'All' || 
        (activeTab === 'Unassigned' && t.status === 'Open') ||
        (activeTab === 'Pending' && t.status === 'Pending');

      return matchesSearch && matchesTab;
    });
  }, [tickets, searchQuery, activeTab]);

  const handleReply = () => {
    if (!replyText.trim()) return;
    setIsSubmitting(true);
    setTimeout(() => {
      // Simulate success
      setTickets(prev => prev.map(t => 
        t.id === selectedTicket.id ? { ...t, status: 'Resolved' } : t
      ));
      setSelectedTicket(null);
      setReplyText('');
      setIsSubmitting(false);
    }, 1000);
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 page-entry">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-2xl font-bold text-secondary tracking-tight flex items-center gap-2">
            <LifeBuoy className="w-6 h-6 text-primary" /> Support Queue
          </h1>
          <p className="text-sm text-muted">Manage merchant support requests and platform inquiries.</p>
        </div>
        <button 
          onClick={() => setShowNewTicketModal(true)}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-md text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
        >
          <Plus className="w-4 h-4" /> Create Internal Ticket
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { label: 'Open Tickets', value: stats?.open_tickets || 0, icon: MessageSquare, color: 'text-primary', bg: 'bg-blue-50' },
          { label: 'Avg Response', value: '12m', icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Resolved (24H)', value: '148', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Urgent Queue', value: '3', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-l-4 border-l-red-500' },
        ].map((stat, i) => (
          <div key={i} className={`premium-card p-6 rounded-xl flex items-center gap-4 ${stat.border || ''}`}>
             <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center`}>
                <stat.icon className="w-6 h-6" />
             </div>
             <div>
                <p className="text-[10px] font-bold text-muted uppercase tracking-widest">{stat.label}</p>
                <h3 className={`text-2xl font-bold ${stat.color}`}>{stat.value}</h3>
             </div>
          </div>
        ))}
      </div>

      <div className="premium-card rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <h3 className="text-xs font-bold text-secondary uppercase tracking-[0.1em]">Active Tickets</h3>
            <div className="flex gap-4">
              {['All', 'Unassigned', 'Pending'].map(tab => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-xs font-bold transition-all pb-1 border-b-2 ${
                    activeTab === tab ? 'text-primary border-primary' : 'text-muted border-transparent hover:text-secondary'
                  }`}
                >
                  {tab === 'All' ? 'All Tickets' : tab}
                </button>
              ))}
            </div>
          </div>
          <div className="relative w-full md:w-80 group">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${searchQuery ? 'text-primary' : 'text-muted'}`} />
            <input 
              type="text" 
              placeholder="Search by subject, ID, or merchant..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 bg-white border border-border rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all group-hover:border-primary/30"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-100 rounded-full">
                <X className="w-3.5 h-3.5 text-muted" />
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full high-density-table text-left">
            <thead>
              <tr className="bg-slate-50/30">
                <th className="w-12 pl-6">SR.</th>
                <th>Subject & Case ID</th>
                <th>Merchant</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Created</th>
                <th className="pr-6"></th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.map((t, index) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                  <td className="text-xs font-bold text-muted pl-6 py-4">{index + 1}</td>
                  <td className="py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-secondary text-sm">{t.subject}</span>
                      <code className="text-[10px] text-primary font-mono bg-blue-50 px-1.5 py-0.5 rounded w-fit mt-1 uppercase">#{t.id}</code>
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-bold text-secondary">
                        {t.merchant?.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="text-xs font-bold text-secondary">{t.merchant}</span>
                    </div>
                  </td>
                  <td className="py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      t.priority === 'High' ? 'bg-red-50 text-red-600 border border-red-100' :
                      t.priority === 'Medium' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                      'bg-slate-50 text-slate-600 border border-slate-100'
                    }`}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        t.status === 'Open' ? 'bg-blue-500 animate-pulse' :
                        t.status === 'Pending' ? 'bg-orange-500' :
                        'bg-green-500'
                      }`} />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">{t.status}</span>
                    </div>
                  </td>
                  <td className="text-xs text-muted font-medium py-4">{t.created}</td>
                  <td className="py-4 pr-6 text-right">
                    <button 
                      onClick={() => setSelectedTicket(t)}
                      className="flex items-center gap-1.5 text-[10px] font-bold text-primary hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-full transition-all hover:scale-105"
                    >
                      REPLY <ChevronRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-between items-center bg-slate-50/30">
          <p className="text-xs text-muted font-medium">Showing <span className="text-secondary font-bold">{filteredTickets.length}</span> active cases</p>
          <div className="flex items-center gap-2 text-[10px] font-bold text-muted">
            <History className="w-3 h-3" /> Syncing with CRM...
          </div>
        </div>
      </div>

      {/* Reply Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-secondary/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-border bg-slate-50/50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-secondary">Reply to: {selectedTicket.subject}</h3>
                <p className="text-xs text-muted mt-1">Merchant: {selectedTicket.merchant} • ID: #{selectedTicket.id}</p>
              </div>
              <button onClick={() => setSelectedTicket(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>
            <div className="p-8 space-y-6">
               <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                  <p className="text-xs text-secondary italic">"User is unable to process USDT-ERC20 settlements. Claims error 0x92..."</p>
               </div>
               <div className="space-y-2">
                 <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Internal Response</label>
                 <textarea 
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your response to the merchant..."
                    className="w-full h-40 px-4 py-3 bg-white border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
                 />
               </div>
               <div className="flex justify-end gap-3">
                  <button 
                    onClick={() => setSelectedTicket(null)}
                    className="px-6 py-2.5 text-sm font-bold text-muted hover:text-secondary transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleReply}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-8 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-70"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {isSubmitting ? 'Sending...' : 'Send Reply'}
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* New Ticket Modal (Simplified for demo) */}
      {showNewTicketModal && (
        <div className="fixed inset-0 bg-secondary/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 space-y-6">
              <div className="text-center space-y-2">
                 <div className="w-12 h-12 bg-blue-50 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Plus className="w-6 h-6" />
                 </div>
                 <h3 className="text-xl font-bold text-secondary">Create Internal Case</h3>
                 <p className="text-sm text-muted">Initialize a support thread on behalf of a merchant.</p>
              </div>
              <div className="space-y-4">
                 <input placeholder="Merchant Name" className="w-full px-4 py-3 bg-slate-50 border border-border rounded-xl text-sm outline-none" />
                 <input placeholder="Subject" className="w-full px-4 py-3 bg-slate-50 border border-border rounded-xl text-sm outline-none" />
                 <select className="w-full px-4 py-3 bg-slate-50 border border-border rounded-xl text-sm outline-none cursor-pointer">
                    <option>High Priority</option>
                    <option>Medium Priority</option>
                    <option>Low Priority</option>
                 </select>
              </div>
              <div className="flex gap-3">
                 <button onClick={() => setShowNewTicketModal(false)} className="flex-1 py-3 text-sm font-bold text-muted hover:text-secondary">Cancel</button>
                 <button onClick={() => setShowNewTicketModal(false)} className="flex-1 py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all">Create Ticket</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
