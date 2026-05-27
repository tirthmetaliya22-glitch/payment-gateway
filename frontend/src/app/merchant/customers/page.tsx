'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  MoreVertical,
  Mail,
  X,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Trash2,
  ExternalLink,
  Loader2,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { API_URL, apiFetch } from '@/lib/api';

export default function CustomersPage() {
  const { userEmail, logout } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCustomers = async () => {
    if (!userEmail) return;
    setIsLoading(true);
    setConnectionError(false);
    try {
      const res = await apiFetch(`/merchant/customers`);
      if (res.status === 401 || res.status === 403) {
        console.warn("Unauthorized access to merchant customers. Status:", res.status);
        logout();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      } else {
        throw new Error("Failed to fetch customers");
      }
    } catch (err) {
      console.error("Customers fetch error:", err);
      setConnectionError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [userEmail]);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail) return;
    
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`/merchant/customers`, {
        method: 'POST',
        body: JSON.stringify({
          ...newCustomer,
          merchant_email: userEmail
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setCustomers([data.customer, ...customers]);
        setNewCustomer({ name: '', email: '' });
        setShowAddModal(false);
      }
    } catch (err) {
      console.error("Add customer error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const customersWithSr = useMemo(() => {
    return customers.map((c, index) => ({ ...c, sr: index + 1 }));
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    return customersWithSr.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.user_id && c.user_id.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [searchQuery, customersWithSr]);

  const effectiveItemsPerPage = itemsPerPage === -1 ? filteredCustomers.length : itemsPerPage;
  const totalPages = Math.ceil(filteredCustomers.length / (effectiveItemsPerPage || 1));

  const paginatedCustomers = useMemo(() => {
    if (itemsPerPage === -1) return filteredCustomers;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredCustomers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredCustomers, currentPage, itemsPerPage]);


  const handleDeleteCustomer = async (id: string) => {
    try {
      const res = await apiFetch(`/merchant/customers/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setCustomers(customers.filter(c => c.id !== id));
      } else {
        alert("Failed to delete customer");
      }
    } catch (err) {
      console.error("Delete customer error:", err);
      alert("An error occurred while deleting the customer");
    }
  };

  return (
    <div className="p-8 page-entry">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-secondary tracking-tight">Customers</h1>
          <p className="text-xs md:text-sm text-muted">Manage your customer relationships and transaction history.</p>
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
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
          >
            <Plus className="w-4 h-4" /> <span>Add Customer</span>
          </button>
        </div>
      </div>

      <div className="premium-card rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
            <p className="text-sm font-bold text-secondary uppercase tracking-widest">Loading Customers...</p>
          </div>
        ) : connectionError ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white">
            <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
            <p className="text-sm font-bold text-secondary uppercase tracking-widest mb-2">Connection Error</p>
            <p className="text-xs text-muted mb-6">Failed to retrieve customer data.</p>
            <button 
              onClick={fetchCustomers}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 transition-all shadow-lg shadow-emerald-100"
            >
              <RotateCcw className="w-4 h-4" /> Retry Fetch
            </button>
          </div>
        ) : (
          <>
            <div className="px-4 md:px-6 py-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
              <div className="relative w-full md:w-64 group">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 transition-colors ${searchQuery ? 'text-primary' : 'text-muted'}`} />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or email..." 
                  className="w-full pl-9 pr-4 py-1.5 bg-white border border-border rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-primary transition-all group-hover:border-primary/30"
                />
              </div>
              <div className="flex items-center gap-4 text-[10px] md:text-xs font-bold text-muted">
                <span>
                  Showing {filteredCustomers.length === 0 ? 0 : (itemsPerPage === -1 ? 1 : (currentPage - 1) * itemsPerPage + 1)}-{itemsPerPage === -1 ? filteredCustomers.length : Math.min(filteredCustomers.length, currentPage * itemsPerPage)} of {filteredCustomers.length} results
                </span>
              </div>
            </div>
        
        <div className="overflow-x-auto">
          {/* Desktop Table View */}
          <table className="w-full high-density-table text-left hidden md:table">
            <thead>
              <tr>
                <th className="w-12">SR.</th>
                <th>Customer</th>
                <th>Contact</th>
                <th>Orders</th>
                <th>Total Spend</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paginatedCustomers.map((c, index) => (
                <tr key={`${c.id}-${index}`} className="hover:bg-slate-50 transition-colors">
                  <td className="text-xs font-bold text-muted">
                    {(c as any).sr}
                  </td>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-primary font-bold text-xs">
                        {c.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-secondary">{c.name}</p>
                        <p className="text-[10px] text-muted font-mono">{c.id}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-muted">
                        <Mail className="w-3 h-3" /> {c.email}
                      </div>
                    </div>
                  </td>
                  <td className="text-sm font-medium text-secondary">{c.orders}</td>
                  <td className="font-bold text-secondary">{c.totalSpend}</td>
                  <td className="text-xs text-muted">{c.joined}</td>
                  <td className="pr-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleDeleteCustomer(c.id)}
                        className="p-1.5 text-muted hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                        title="Delete Customer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-border">
            {paginatedCustomers.map((c, index) => (
              <div key={`mob-cust-${c.id}-${index}`} className="p-4 space-y-4 hover:bg-slate-50 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-primary font-bold text-sm border-2 border-white shadow-sm">
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-secondary text-sm">{c.name}</h4>
                      <p className="font-mono text-[9px] text-muted">{c.id}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleDeleteCustomer(c.id)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors text-muted hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-col gap-1 px-1">
                  <div className="flex items-center gap-2 text-[10px] text-muted">
                    <Mail className="w-3.5 h-3.5 text-primary" /> {c.email}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-border/50">
                  <div className="space-y-0.5">
                    <p className="text-[8px] font-bold text-muted uppercase tracking-wider">Orders</p>
                    <p className="text-[10px] font-bold text-secondary">{c.orders}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[8px] font-bold text-muted uppercase tracking-wider">Spent</p>
                    <p className="text-[10px] font-bold text-secondary">{c.totalSpend}</p>
                  </div>
                  <div className="space-y-0.5 text-right">
                    <p className="text-[8px] font-bold text-muted uppercase tracking-wider">Joined</p>
                    <p className="text-[10px] font-bold text-secondary">{c.joined}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {paginatedCustomers.length === 0 && (
            <div className="py-20 text-center">
              <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-sm font-bold text-secondary">No customers found</p>
              <p className="text-xs text-muted mt-1">Try a different search term.</p>
            </div>
          )}
        </div>
        {itemsPerPage !== -1 && totalPages > 1 && (
          <div className="px-6 py-6 border-t border-border flex flex-col items-center gap-4 bg-slate-50/10">
            <div className="flex items-center bg-white border border-border/50 rounded-lg shadow-sm overflow-hidden p-1">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="w-10 h-10 flex items-center justify-center text-muted hover:text-secondary hover:bg-slate-50 disabled:opacity-20 transition-all rounded-md"
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
                      <span key={`dots-${i}`} className="w-10 h-10 flex items-center justify-center text-muted text-xs font-bold">...</span>
                    ) : (
                      <button 
                        key={page}
                        onClick={() => setCurrentPage(page as number)}
                        className={`w-10 h-10 flex items-center justify-center text-xs font-bold transition-all rounded-md mx-0.5 ${
                          currentPage === page 
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
                disabled={currentPage === totalPages || totalPages === 0}
                className="w-10 h-10 flex items-center justify-center text-muted hover:text-secondary hover:bg-slate-50 disabled:opacity-20 transition-all rounded-md"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
          </>
        )}
      </div>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in fade-in duration-300">
            <div className="px-8 py-6 border-b border-border flex justify-between items-center">
              <h2 className="text-xl font-bold text-secondary">Add New Customer</h2>
              <button onClick={() => setShowAddModal(false)} className="text-muted hover:text-secondary"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddCustomer} className="p-8 space-y-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Email Address</label>
                <input 
                  type="email" 
                  required
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="john@example.com"
                />
              </div>
              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-primary text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 group shadow-lg shadow-blue-100 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>Create Customer <CheckCircle2 className="w-4 h-4" /></>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
