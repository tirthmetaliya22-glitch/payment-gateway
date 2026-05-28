'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Terminal, 
  Search, 
  Download, 
  Filter,
  Info,
  AlertCircle,
  Shield,
  Loader2,
  X,
  ChevronDown,
  CheckCircle2,
  Lock,
  History,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

import { API_URL, apiFetch } from '@/lib/api';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setError(null);
        const res = await apiFetch(`/admin/logs`);
        if (!res.ok) throw new Error('Failed to fetch logs');
        const data = await res.json();
        setLogs(data);
      } catch (err) {
        if (err instanceof TypeError && err.message === 'Failed to fetch') {
          console.warn(`Backend connectivity issue: Server at ${API_URL} is unreachable.`);
        } else {
          console.error("Failed to fetch logs:", err);
        }
        setError(`Unable to connect to the backend server. Please ensure the backend is running and accessible at ${API_URL}.`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const logsWithSr = useMemo(() => {
    return [...logs]
      .sort((a, b) => {
        const timeA = new Date(a.timestamp || a.time).getTime();
        const timeB = new Date(b.timestamp || b.time).getTime();
        return timeB - timeA;
      })
      .map((log, index) => ({ ...log, sr: index + 1 }));
  }, [logs]);

  // Filtering Logic
  const filteredLogs = useMemo(() => {
    return logsWithSr.filter(log => {
      const matchesSearch = 
        (log.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.user || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.action || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.target || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'All' || 
        (statusFilter === 'Critical' && log.status === 'Warning') ||
        (statusFilter === 'Normal' && log.status !== 'Warning');

      return matchesSearch && matchesStatus;
    });
  }, [logsWithSr, searchQuery, statusFilter]);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const effectiveItemsPerPage = itemsPerPage === -1 ? filteredLogs.length : itemsPerPage;
  const totalPages = Math.ceil(filteredLogs.length / (effectiveItemsPerPage || 1));

  const paginatedLogs = useMemo(() => {
    if (itemsPerPage === -1) return filteredLogs;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLogs, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, itemsPerPage]);

  const handleExport = () => {
    if (!filteredLogs || filteredLogs.length === 0) {
      alert("No data to export");
      return;
    }
    const headers = Object.keys(filteredLogs[0]).join(',');
    const csvRows = filteredLogs.map(row => 
      Object.values(row).map(value => {
        const strVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
        return `"${strVal.replace(/"/g, '""')}"`;
      }).join(',')
    );
    const csvString = [headers, ...csvRows].join('\n');
    const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csvString);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `audit_logs_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 page-entry">
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <div>
              <p className="text-red-800 text-xs font-bold">Backend Connectivity Error</p>
              <p className="text-red-600 text-[10px]">{error}</p>
            </div>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-[10px] font-bold hover:bg-red-200 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-secondary tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-primary" /> Audit Logs
          </h1>
          <p className="text-xs md:text-sm text-muted">Complete history of system actions and security events.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2 bg-white px-3 py-2 border border-border rounded-md shrink-0">
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
          <div className="relative flex-1 sm:flex-initial">
            <button 
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className="w-full flex items-center justify-between gap-2 px-4 py-2 bg-white border border-border rounded-md text-sm font-medium text-secondary hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4" /> 
                <span>{statusFilter}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {showFilterMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-border rounded-lg shadow-xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <button onClick={() => { setStatusFilter('All'); setShowFilterMenu(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 border-b border-border/50">All Levels</button>
                <button onClick={() => { setStatusFilter('Normal'); setShowFilterMenu(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 border-b border-border/50">Normal Events</button>
                <button onClick={() => { setStatusFilter('Critical'); setShowFilterMenu(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-red-600">Critical Warnings</button>
              </div>
            )}
          </div>
          <button 
            onClick={handleExport}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2 bg-primary text-white rounded-md text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
          >
            <Download className="w-4 h-4" /> 
            <span className="hidden sm:inline">Export Logs</span>
            <span className="sm:hidden">Export</span>
          </button>
        </div>
      </div>

      <div className="premium-card rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md group">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${searchQuery ? 'text-primary' : 'text-muted'}`} />
            <input 
              type="text" 
              placeholder="Search by ID, user, or action..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 bg-white border border-border rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all group-hover:border-primary/30"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-100 rounded-full"
              >
                <X className="w-3.5 h-3.5 text-muted hover:text-secondary" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs font-bold text-muted">
            <span>
              Showing {filteredLogs.length === 0 ? 0 : (itemsPerPage === -1 ? 1 : (currentPage - 1) * itemsPerPage + 1)}-{itemsPerPage === -1 ? filteredLogs.length : Math.min(filteredLogs.length, currentPage * itemsPerPage)} of {filteredLogs.length} events
            </span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full high-density-table text-left">
            <thead>
              <tr className="bg-slate-50/30">
                <th className="w-12 pl-6 hidden lg:table-cell whitespace-nowrap">SR.</th>
                <th className="whitespace-nowrap hidden sm:table-cell">Event ID</th>
                <th className="whitespace-nowrap">User Identity</th>
                <th className="whitespace-nowrap">System Action</th>
                <th className="whitespace-nowrap hidden md:table-cell">Target Resource</th>
                <th className="whitespace-nowrap hidden sm:table-cell">Risk Level</th>
                <th className="pr-6 whitespace-nowrap">Timestamp</th>
              </tr>
            </thead>
            <tbody className="stagger-entry">
              {paginatedLogs.map((log, index) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                  <td className="text-xs font-bold text-muted pl-6 py-4 hidden lg:table-cell whitespace-nowrap">
                    {(log as any).sr}
                  </td>
                  <td className="py-4 hidden sm:table-cell whitespace-nowrap">
                    <code className="text-[10px] font-bold text-primary bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 font-mono">
                      {log.id}
                    </code>
                  </td>
                  <td className="py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                       <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-secondary uppercase">
                         {log.user?.charAt(0) || 'U'}
                       </div>
                       <span className="font-bold text-secondary text-xs">{log.user}</span>
                    </div>
                  </td>
                  <td className="py-4 whitespace-nowrap">
                    <span className="text-[10px] font-bold text-secondary uppercase tracking-wider bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                      {log.action}
                    </span>
                  </td>
                  <td className="text-[10px] text-muted font-medium py-4 hidden md:table-cell whitespace-nowrap">{log.target}</td>
                  <td className="py-4 hidden sm:table-cell whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {log.status !== 'Warning' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />
                      )}
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${log.status !== 'Warning' ? 'text-blue-600' : 'text-yellow-600'}`}>
                        {log.status === 'Warning' ? 'Critical' : 'Normal'}
                      </span>
                    </div>
                  </td>
                  <td className="text-xs text-muted font-mono py-4 pr-6 whitespace-nowrap">
                    {new Date(log.timestamp || log.time).toLocaleString()}
                  </td>
                </tr>
              ))}
              {paginatedLogs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-20 text-center text-muted italic">
                    {logs.length === 0 ? 'No audit logs found in database.' : 'No logs match your search or filter.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
                            ? 'bg-primary text-white shadow-md shadow-emerald-200' 
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
      </div>
    </div>
  );
}
