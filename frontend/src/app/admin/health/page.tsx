'use client';

import React, { useState, useEffect } from 'react';
import { 
  Server, 
  Activity, 
  Database, 
  ShieldCheck, 
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Globe,
  Clock,
  BarChart3,
  Search,
  X
} from 'lucide-react';

// Simulated node data generator
const generateNodes = () => [
  { name: 'Gateway-US-East-1', status: Math.random() > 0.1 ? 'Healthy' : 'Warning', load: `${Math.floor(Math.random() * 60 + 10)}%`, latency: `${Math.floor(Math.random() * 20 + 5)}ms`, uptime: '99.99%', region: 'US East' },
  { name: 'Gateway-US-East-2', status: 'Healthy', load: `${Math.floor(Math.random() * 60 + 10)}%`, latency: `${Math.floor(Math.random() * 25 + 10)}ms`, uptime: '99.98%', region: 'US East' },
  { name: 'Gateway-EU-West-1', status: Math.random() > 0.2 ? 'Healthy' : 'Warning', load: `${Math.floor(Math.random() * 50 + 40)}%`, latency: `${Math.floor(Math.random() * 100 + 30)}ms`, uptime: '99.95%', region: 'Europe' },
  { name: 'Auth-Cluster-Syd', status: 'Healthy', load: `${Math.floor(Math.random() * 40 + 5)}%`, latency: `${Math.floor(Math.random() * 60 + 40)}ms`, uptime: '99.99%', region: 'Australia' },
  { name: 'DB-Primary-Main', status: 'Healthy', load: `${Math.floor(Math.random() * 30 + 15)}%`, latency: `${Math.floor(Math.random() * 5 + 1)}ms`, uptime: '100%', region: 'Global' },
];

export default function SystemHealthPage() {
  const [nodes, setNodes] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [searchQuery, setSearchQuery] = useState('');

  const refreshHealth = () => {
    setIsRefreshing(true);
    // Simulate API delay
    setTimeout(() => {
      setNodes(generateNodes());
      setLastUpdated(new Date());
      setIsRefreshing(false);
    }, 800);
  };

  useEffect(() => {
    setNodes(generateNodes());
    setLastUpdated(new Date());
  }, []);


  const filteredNodes = nodes.filter(node => 
    node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    node.region.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const healthyCount = nodes.filter(n => n.status === 'Healthy').length;

  return (
    <div className="p-8 page-entry">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary tracking-tight">System Health</h1>
          <p className="text-sm text-muted">Real-time infrastructure monitoring and node status.</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input 
              type="text" 
              placeholder="Filter nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 bg-white border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-100 rounded-full"
              >
                <X className="w-3 h-3 text-muted" />
              </button>
            )}
          </div>
          <button 
            onClick={refreshHealth}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-md text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-70"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> 
            {isRefreshing ? 'Checking...' : 'Refresh All'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="premium-card p-6 rounded-xl flex items-center gap-4 border-l-4 border-l-green-500">
          <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-600">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Overall Status</p>
            <h3 className="text-xl font-bold text-secondary">{healthyCount === nodes.length ? 'Optimal' : 'Degraded'}</h3>
          </div>
        </div>
        
        <div className="premium-card p-6 rounded-xl flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-primary">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Active Threads</p>
            <h3 className="text-xl font-bold text-secondary">1,420</h3>
          </div>
        </div>
        
        <div className="premium-card p-6 rounded-xl flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Storage Load</p>
            <h3 className="text-xl font-bold text-secondary">24%</h3>
          </div>
        </div>

        <div className="premium-card p-6 rounded-xl flex items-center gap-4">
          <div className="w-12 h-12 bg-yellow-50 rounded-2xl flex items-center justify-center text-yellow-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Avg Latency</p>
            <h3 className="text-xl font-bold text-secondary">12ms</h3>
          </div>
        </div>
      </div>

      <div className="premium-card rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-bold text-secondary uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" /> Infrastructure Nodes
            </h3>
            <span className="text-[10px] font-bold text-primary bg-blue-50 px-2 py-0.5 rounded-full uppercase">
              Last Updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Loading...'}

            </span>
          </div>
          <div className="flex items-center gap-2">
             <div className="flex items-center gap-1.5 mr-4">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-[10px] font-bold text-muted">{healthyCount} Healthy</span>
             </div>
             <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="text-[10px] font-bold text-muted">{nodes.length - healthyCount} Warning</span>
             </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full high-density-table text-left">
            <thead>
              <tr className="bg-slate-50/30">
                <th className="w-12 pl-6">SR.</th>
                <th>Node Name</th>
                <th>Region</th>
                <th>Status</th>
                <th>Load</th>
                <th>Latency</th>
                <th>Uptime</th>
                <th className="text-right pr-6">Health Score</th>
              </tr>
            </thead>
            <tbody>
              {filteredNodes.map((node, index) => (
                <tr key={node.name} className={`hover:bg-slate-50 transition-colors ${isRefreshing ? 'opacity-50' : ''}`}>
                  <td className="text-xs font-bold text-muted pl-6 py-4">{index + 1}</td>
                  <td className="py-4">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-lg ${node.status === 'Healthy' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                        <Server className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-bold text-secondary">{node.name}</span>
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-1.5 text-xs text-muted font-medium">
                      <Globe className="w-3 h-3" /> {node.region}
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-1.5">
                      {node.status === 'Healthy' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
                      )}
                      <span className={`text-xs font-bold ${node.status === 'Healthy' ? 'text-green-600' : 'text-yellow-600'}`}>{node.status}</span>
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="w-24">
                       <div className="flex justify-between text-[10px] mb-1 font-bold text-muted">
                         <span>CPU</span>
                         <span>{node.load}</span>
                       </div>
                       <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                         <div 
                          className={`h-full rounded-full ${parseInt(node.load) > 70 ? 'bg-yellow-500' : 'bg-primary'}`} 
                          style={{ width: node.load }} 
                         />
                       </div>
                    </div>
                  </td>
                  <td className="py-4">
                    <span className="text-xs font-bold text-secondary bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1 w-fit">
                      <Clock className="w-3 h-3 text-muted" /> {node.latency}
                    </span>
                  </td>
                  <td className="text-xs text-muted font-mono py-4">{node.uptime}</td>
                  <td className="py-4 text-right pr-6">
                    <div className="flex items-center justify-end gap-2">
                       <div className="w-10 h-10 rounded-full border-2 border-slate-100 flex items-center justify-center text-[10px] font-bold text-secondary bg-white">
                         {node.status === 'Healthy' ? '99' : '74'}
                       </div>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredNodes.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-20 text-center text-muted italic">No nodes matching your search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-between items-center bg-slate-50/30">
          <p className="text-[10px] font-bold text-muted uppercase">Global Infrastructure Status: <span className="text-green-600 ml-1">STABLE</span></p>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted">
            <BarChart3 className="w-3 h-3 text-primary" /> Data updated every 30s
          </div>
        </div>
      </div>
    </div>
  );
}
