import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Users, 
  Database, 
  Activity, 
  Zap, 
  BarChart3, 
  Bell, 
  Flag, 
  Terminal, 
  Settings, 
  LogOut, 
  ShieldCheck, 
  Search, 
  Filter, 
  ArrowUpRight, 
  ArrowDownRight, 
  ArrowRight,
  Globe, 
  Server, 
  Cpu, 
  AlertTriangle,
  ChevronRight,
  MoreVertical,
  Code2,
  Lock,
  Wifi,
  History,
  CreditCard,
  Rocket,
  Table,
  X,
  Trash2,
  Monitor
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { developerApi } from '@/lib/developer-api';
import { io, Socket } from 'socket.io-client';
import { cryptoUtils } from '@/lib/crypto';

// --- Types ---
type NavItem = 
  | 'dashboard' 
  | 'clients' 
  | 'live'
  | 'activity' 
  | 'analytics' 
  | 'security' 
  | 'ai'
  | 'supabase' 
  | 'usage'
  | 'subscriptions'
  | 'notifications' 
  | 'logs' 
  | 'releases'
  | 'db_explorer'
  | 'health' 
  | 'settings' 
  | 'integrations'
  | 'tools';

// --- Props Interfaces ---
interface SidebarProps {
  activeTab: NavItem;
  setActiveTab: (tab: NavItem) => void;
  isSidebarCollapsed: boolean;
  handleLogout: () => void;
}

interface DashboardViewProps {
  stats: any;
  statsLoading: boolean;
  activityFeed: any[];
  clients: any[];
  setActiveTab: (tab: NavItem) => void;
}

interface AIViewProps {
  aiQuery: string;
  setAiQuery: (query: string) => void;
  aiResponse: string | null;
  isAiLoading: boolean;
  handleAiQuery: () => void;
}

interface SecurityViewProps {
  clients: any[];
  activityFeed: any[];
  toast: any;
  queryClient: any;
}

interface ClientsViewProps {
  clients: any[];
  clientsLoading: boolean;
}

interface IntegrationsViewProps {
  settings: any[];
  refetchSettings: () => void;
  toast: any;
}

// --- Sub-view Components (Defined outside to prevent re-mounting focus issues) ---

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isSidebarCollapsed, handleLogout }) => (
  <div className={cn(
    "bg-[#0A0A0B] border-r border-white/5 h-screen transition-all duration-500 flex flex-col fixed left-0 top-0 z-50",
    isSidebarCollapsed ? "w-20" : "w-72"
  )}>
    <div className="p-6 flex items-center gap-3 mb-8">
      <div className="w-10 h-10 rounded-xl bg-[#BF953F] flex items-center justify-center flex-none">
        <Terminal className="w-6 h-6 text-black" />
      </div>
      {!isSidebarCollapsed && (
        <div className="overflow-hidden whitespace-nowrap">
          <h2 className="text-white font-black tracking-tighter text-xl">DEV CONSOLE</h2>
          <p className="text-[#BF953F] text-[8px] font-black uppercase tracking-[0.3em]">SmartPOS+ V2.0.1</p>
        </div>
      )}
    </div>

    <div className="flex-1 overflow-y-auto px-3 no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      {[
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'clients', label: 'Clients', icon: Users },
        { id: 'live', label: 'Live Monitoring', icon: Globe },
        { id: 'activity', label: 'Activity Feed', icon: History },
        { id: 'analytics', label: 'Analytics Center', icon: BarChart3 },
        { id: 'security', label: 'Security Center', icon: ShieldCheck },
        { id: 'ai', label: 'AI Assistant', icon: Zap },
        { id: 'supabase', label: 'Supabase Monitor', icon: Database },
        { id: 'usage', label: 'Feature Usage', icon: Flag },
        { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'logs', label: 'Error Logs', icon: AlertTriangle },
        { id: 'releases', label: 'Release Center', icon: Rocket },
        { id: 'db_explorer', label: 'DB Explorer', icon: Table },
        { id: 'health', label: 'System Health', icon: Activity },
        { id: 'integrations', label: 'Integrations', icon: Zap },
        { id: 'settings', label: 'Settings', icon: Settings },
        { id: 'tools', label: 'Developer Tools', icon: Code2 },
      ].map((item) => (
        <button
          key={item.id}
          onClick={(e) => {
            e.preventDefault();
            setActiveTab(item.id as NavItem);
          }}
          className={cn(
            "w-full flex items-center gap-3 p-4 rounded-2xl transition-all mb-1 group text-left",
            activeTab === item.id 
              ? "bg-[#BF953F] text-black shadow-lg shadow-[#BF953F]/20" 
              : "text-gray-500 hover:bg-white/5 hover:text-white"
          )}
        >
          <item.icon className={cn("w-5 h-5 flex-none", activeTab === item.id ? "text-black" : "group-hover:text-[#BF953F]")} />
          {!isSidebarCollapsed && <span className="text-[11px] font-black uppercase tracking-widest">{item.label}</span>}
        </button>
      ))}
    </div>

    <div className="p-4 mt-auto">
      <button
        onClick={handleLogout}
        className="w-full flex items-center gap-3 p-4 rounded-2xl text-red-500 hover:bg-red-500/10 transition-all group"
      >
        <LogOut className="w-5 h-5 flex-none" />
        {!isSidebarCollapsed && <span className="text-[11px] font-black uppercase tracking-widest">Terminate Session</span>}
      </button>
    </div>
  </div>
);

const DashboardView: React.FC<DashboardViewProps> = ({ stats, statsLoading, activityFeed, clients, setActiveTab }) => {
  const geoDist = React.useMemo(() => {
    if (!clients || clients.length === 0) return [];
    const counts: Record<string, number> = {};
    clients.forEach((c: any) => {
      const loc = c.location || 'Unknown';
      counts[loc] = (counts[loc] || 0) + 1;
    });
    const colors = ['#BF953F', '#3B82F6', '#A855F7', '#6B7280'];
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([city, count], i) => ({
        city,
        share: `${Math.round((count / clients.length) * 100)}%`,
        color: colors[i % colors.length]
      }));
  }, [clients]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Clients', value: stats?.totalStores || '0', icon: Users, color: 'blue', trend: '+12%', up: true },
          { label: 'Online Users', value: stats?.onlineStores || '0', icon: Globe, color: 'emerald', trend: '+5%', up: true },
          { label: 'Supabase Status', value: stats?.systemHealth || 'Healthy', icon: Database, color: 'amber', trend: '99.9%', up: true },
          { label: 'System Uptime', value: '99.98%', icon: Zap, color: 'purple', trend: '0.01%', up: false },
        ].map((kpi, i) => (
          <Card key={i} className="bg-white/5 border-white/10 p-6 rounded-[2rem] hover:bg-white/[0.07] transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", `bg-${kpi.color}-500/10`)}>
                <kpi.icon className={cn("w-6 h-6", `text-${kpi.color}-500`)} />
              </div>
              <div className={cn("flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg bg-white/5", kpi.up ? "text-emerald-500" : "text-red-500")}>
                {kpi.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {kpi.trend}
              </div>
            </div>
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">{kpi.label}</p>
            <p className="text-2xl font-black text-white tracking-tighter">{statsLoading ? '...' : kpi.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-white font-black text-lg uppercase tracking-tight">Real-time Activity</h3>
            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-white" onClick={() => setActiveTab('activity')}>View Full Logs</Button>
          </div>
          <div className="space-y-6">
            {(activityFeed || []).slice(0, 5).map((log: any, i: number) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/5 transition-all group">
                <div className="text-[10px] font-black text-gray-600 w-16">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                <div className="w-2 h-2 rounded-full bg-[#BF953F]/30 group-hover:bg-[#BF953F] transition-colors"></div>
                <div className="flex-1">
                  <p className="text-white text-xs font-bold">{log.description}</p>
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{log.event_type} • {log.store_id || 'System'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-[#BF953F] p-8 rounded-[2.5rem] text-black relative overflow-hidden group">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4">Storage Consumption</h3>
            <p className="text-4xl font-black tracking-tighter">{statsLoading ? '...' : `${(Number(stats?.totalStorage || 0) / (1024 * 1024 * 1024)).toFixed(1)} GB`}</p>
            <div className="h-2 bg-black/10 rounded-full overflow-hidden mt-4">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((Number(stats?.totalStorage || 0) / (50 * 1024 * 1024 * 1024)) * 100, 100)}%` }}
                className="h-full bg-black"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AIView: React.FC<AIViewProps> = ({ aiQuery, setAiQuery, aiResponse, isAiLoading, handleAiQuery }) => (
  <div className="space-y-8">
    <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10 relative overflow-hidden">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-[#BF953F] flex items-center justify-center">
          <Zap className="w-6 h-6 text-black" />
        </div>
        <div>
          <h3 className="text-white font-black text-xl uppercase tracking-tight">AI Developer Assistant</h3>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Natural Language Ecosystem Query</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-black/40 rounded-[2rem] p-8 border border-white/5 min-h-[300px] flex flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto max-h-[400px] pr-2 no-scrollbar">
            {aiResponse ? (
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-lg bg-[#BF953F] flex items-center justify-center flex-none">
                  <Zap className="w-4 h-4 text-black" />
                </div>
                <div className="bg-[#BF953F]/10 p-4 rounded-2xl rounded-tl-none border border-[#BF953F]/20">
                  <p className="text-white text-xs leading-relaxed">{aiResponse}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 opacity-20">
                <Zap className="w-12 h-12 text-gray-400 mb-4" />
                <p className="text-white text-[10px] font-black uppercase tracking-widest text-center">Ready to analyze ecosystem data</p>
              </div>
            )}
            {isAiLoading && (
              <div className="flex gap-4 items-start animate-pulse">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-none">
                  <Cpu className="w-4 h-4 text-gray-400 animate-spin" />
                </div>
                <div className="bg-white/5 p-4 rounded-2xl rounded-tl-none border border-white/5">
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Processing query...</p>
                </div>
              </div>
            )}
          </div>
          <div className="mt-8 relative">
            <Input 
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAiQuery()}
              placeholder="Ask anything about the system..." 
              className="h-14 bg-white/5 border-white/10 rounded-2xl pl-6 pr-16 text-white text-sm font-bold focus:ring-[#BF953F]/20"
            />
            <Button 
              onClick={handleAiQuery}
              disabled={isAiLoading}
              className="absolute right-2 top-2 h-10 w-10 bg-[#BF953F] hover:bg-[#BF953F]/80 text-black rounded-xl p-0"
            >
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const SecurityView: React.FC<SecurityViewProps> = ({ clients, activityFeed, toast, queryClient }) => {
  const onlineClients = clients?.filter((c: any) => c.status === 'online') || [];
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white/5 border-white/10 p-8 rounded-[2.5rem]">
          <h3 className="text-gray-500 text-[9px] font-black uppercase tracking-widest mb-4">Security Score</h3>
          <p className="text-5xl font-black text-emerald-500 tracking-tighter">94/100</p>
        </Card>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden">
        <div className="p-8 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-white font-black text-lg uppercase tracking-tight">Active Terminal Sessions</h3>
          <Button onClick={() => developerApi.globalLogout()} variant="outline" className="text-red-500">Global Logout</Button>
        </div>
      </div>
    </div>
  );
};

const ClientsView: React.FC<ClientsViewProps> = ({ clients, clientsLoading }) => (
  <div className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden">
    <div className="p-8 border-b border-white/5">
      <h3 className="text-white font-black text-lg uppercase tracking-tight">Managed Ecosystem</h3>
    </div>
    <div className="overflow-x-auto">
      {clientsLoading ? (
        <div className="p-20 text-center text-gray-500 uppercase">Loading...</div>
      ) : (
        <table className="w-full text-left">
          <tbody className="divide-y divide-white/5">
            {(clients || []).map((client: any) => (
              <tr key={client.id} className="hover:bg-white/[0.03]">
                <td className="p-6">
                  <p className="text-white font-bold">{client.storeName}</p>
                  <p className="text-[9px] text-gray-600">{client.email}</p>
                </td>
                <td className="p-6">
                  <span className={cn("text-[10px] uppercase font-black", client.status === 'online' ? 'text-emerald-500' : 'text-gray-600')}>
                    {client.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </div>
);

const IntegrationsView: React.FC<IntegrationsViewProps> = ({ settings, refetchSettings, toast }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newIntegration, setNewIntegration] = useState({ name: '', config: {} });

  const activeIntegrations = settings?.filter((s: any) => s.category === 'integrations' && s.value) || [];

  return (
    <div className="space-y-8">
      <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10">
        <div className="flex justify-between mb-10">
          <h3 className="text-white font-black text-2xl uppercase">External Integrations</h3>
          <Button onClick={() => setIsAdding(true)} className="bg-[#BF953F] text-black">Add Integration</Button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {activeIntegrations.map((integration: any) => (
            <div key={integration.key} className="bg-white/5 border border-white/10 rounded-[2rem] p-8 relative group">
              <button onClick={() => developerApi.updateSetting(integration.key, null, 'integrations').then(() => refetchSettings())} className="absolute top-4 right-4 text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100">
                <Trash2 className="w-4 h-4" />
              </button>
              <h4 className="text-white font-black uppercase text-sm">{integration.key.replace('_config', '').toUpperCase()}</h4>
            </div>
          ))}
        </div>
      </div>
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
            <Card className="w-full max-w-xl bg-[#0A0A0B] border-white/10 p-10 rounded-[3rem]">
              <div className="flex justify-between mb-8">
                <h3 className="text-white font-black text-2xl uppercase">Add Integration</h3>
                <Button variant="ghost" onClick={() => setIsAdding(false)}><X className="w-6 h-6" /></Button>
              </div>
              <Input placeholder="Service Name" className="mb-4" value={newIntegration.name} onChange={e => setNewIntegration(prev => ({ ...prev, name: e.target.value }))} />
              <textarea placeholder='JSON Config' className="w-full h-40 bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-mono text-xs mb-4" onChange={e => { try { setNewIntegration(prev => ({ ...prev, config: JSON.parse(e.target.value) })) } catch(e) {} }} />
              <Button onClick={() => developerApi.updateSetting(`${newIntegration.name}_config`, newIntegration.config, 'integrations').then(() => { refetchSettings(); setIsAdding(false); })} className="w-full bg-[#BF953F] text-black">Deploy</Button>
            </Card>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const DeveloperConsole: React.FC = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<NavItem>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('is_dev') !== 'true') setLocation('/developer-login');
  }, [setLocation]);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dev-stats'],
    queryFn: () => developerApi.getDashboardStats(),
    refetchInterval: 30000
  });

  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['dev-clients', searchQuery],
    queryFn: () => developerApi.getClients({ search: searchQuery })
  });

  const { data: activityFeed } = useQuery({
    queryKey: ['dev-activity', activeTab],
    queryFn: () => developerApi.getActivityFeed({ limit: 50 }),
    enabled: activeTab === 'activity' || activeTab === 'dashboard'
  });

  const { data: settings, refetch: refetchSettings } = useQuery({
    queryKey: ['dev-settings'],
    queryFn: () => developerApi.getSettings(),
    enabled: activeTab === 'integrations' || activeTab === 'settings'
  });

  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const handleAiQuery = async () => {
    if (!aiQuery.trim()) return;
    setIsAiLoading(true);
    try {
      const res = await developerApi.askAi(aiQuery);
      setAiResponse(res.response);
    } catch (e) {
      toast({ title: "AI Error", description: "Failed to query assistant", variant: "destructive" });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('is_dev');
    setLocation('/developer-login');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardView stats={stats} statsLoading={statsLoading} activityFeed={activityFeed || []} clients={clients || []} setActiveTab={setActiveTab} />;
      case 'ai': return <AIView aiQuery={aiQuery} setAiQuery={setAiQuery} aiResponse={aiResponse} isAiLoading={isAiLoading} handleAiQuery={handleAiQuery} />;
      case 'security': return <SecurityView clients={clients || []} activityFeed={activityFeed || []} toast={toast} queryClient={queryClient} />;
      case 'clients': return <ClientsView clients={clients || []} clientsLoading={clientsLoading} />;
      case 'integrations': return <IntegrationsView settings={settings || []} refetchSettings={refetchSettings} toast={toast} />;
      default: return <div className="p-20 text-center text-gray-500 uppercase font-black">Coming Soon: {activeTab}</div>;
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] font-sans selection:bg-[#BF953F]/30 selection:text-[#BF953F]">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isSidebarCollapsed={isSidebarCollapsed} handleLogout={handleLogout} />
      
      <main className={cn(
        "transition-all duration-500 min-h-screen flex flex-col",
        isSidebarCollapsed ? "pl-20" : "pl-72"
      )}>
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-10 sticky top-0 bg-[#050505]/80 backdrop-blur-xl z-40">
          <div className="flex items-center gap-6">
            <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-2 hover:bg-white/5 rounded-lg text-gray-500 transition-colors">
              <Monitor className="w-5 h-5" />
            </button>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search resources..."
                className="w-80 h-11 bg-white/5 border-white/10 rounded-xl pl-12 text-white text-xs font-bold"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
               <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest">System Live</span>
             </div>
          </div>
        </header>

        <div className="p-10 flex-1 overflow-y-auto no-scrollbar">
          <motion.div 
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {renderContent()}
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default DeveloperConsole;