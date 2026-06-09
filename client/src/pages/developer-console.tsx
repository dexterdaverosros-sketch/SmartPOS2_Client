import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Users, 
  User,
  Database, 
  Activity, 
  TrendingUp,
  FileText, 
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
  Clock,
  Code2,
  Lock,
  Wifi,
  History,
  CreditCard,
  Rocket,
  Table
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { db } from '@/lib/db';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { developerApi } from '@/lib/developer-api';
import { io, Socket } from 'socket.io-client';

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
  | 'tools';

interface StoreUser {
  id: string;
  storeName: string;
  ownerName: string;
  status: 'online' | 'offline';
  storageUsed: string;
  createdDate: string;
  lastActive: string;
  subscription: 'Free' | 'Pro' | 'Enterprise';
  deviceType: string;
  browser: string;
  ip: string;
}

const DeveloperConsole: React.FC = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<NavItem>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Record<string, any>>({});

  // --- Auth Check ---
  useEffect(() => {
    const isDev = localStorage.getItem('is_dev');
    if (isDev !== 'true') {
      setLocation('/developer-login');
    }
  }, [setLocation]);

  // --- Realtime Socket ---
  useEffect(() => {
    const s = io();
    setSocket(s);
    
    s.on('user-status', ({ userId, status, lastActive }) => {
      setOnlineUsers(prev => ({
        ...prev,
        [userId]: { status, lastActive }
      }));
    });

    return () => { s.disconnect(); };
  }, []);

  // --- Queries ---
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dev-stats'],
    queryFn: () => developerApi.getDashboardStats(),
    refetchInterval: 30000 // Refetch every 30s
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

  const { data: flags } = useQuery({
    queryKey: ['dev-flags'],
    queryFn: () => developerApi.getFeatureFlags(),
    enabled: activeTab === 'usage'
  });

  const toggleFlagMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string, enabled: boolean }) => 
      developerApi.toggleFeatureFlag(id, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dev-flags'] })
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
    toast({ title: "Logged Out", description: "Developer session terminated." });
    setLocation('/role-selection');
  };

  // --- Sub-components ---

  const Sidebar = () => (
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

      <div className="flex-1 overflow-y-auto px-3 custom-scrollbar">
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
          { id: 'settings', label: 'Settings', icon: Settings },
          { id: 'tools', label: 'Developer Tools', icon: Code2 },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as NavItem)}
            className={cn(
              "w-full flex items-center gap-3 p-4 rounded-2xl transition-all mb-1 group",
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

  const Header = () => (
    <div className="flex items-center justify-between mb-8 flex-none">
      <div>
        <h1 className="text-3xl font-black text-white tracking-tighter uppercase">
          {activeTab === 'dashboard' ? 'Overview' : activeTab.replace(/([A-Z])/g, ' $1')}
        </h1>
        <p className="text-gray-500 text-xs font-medium">Monitoring SmartPOS+ ecosystem in real-time</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search resources..."
            className="w-64 h-11 bg-white/5 border-white/10 rounded-xl pl-12 text-white text-xs font-bold focus:ring-[#BF953F]/20"
          />
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest">System Live</span>
        </div>
      </div>
    </div>
  );

  const DashboardView = () => (
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
            <p className="text-2xl font-black text-white tracking-tighter">
              {statsLoading ? '...' : kpi.value}
            </p>
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
                <div className={cn(
                  "px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest",
                  log.event_type === 'login' ? 'bg-emerald-500/10 text-emerald-500' :
                  log.event_type === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'
                )}>
                  {log.event_type}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-[#BF953F] p-8 rounded-[2.5rem] text-black relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16 blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4">Storage Consumption</h3>
            <div className="flex items-end justify-between mb-4">
              <p className="text-4xl font-black tracking-tighter">18.4 GB</p>
              <p className="text-[10px] font-black">OF 50 GB</p>
            </div>
            <div className="h-2 bg-black/10 rounded-full overflow-hidden mb-2">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '36.8%' }}
                className="h-full bg-black"
              />
            </div>
            <p className="text-[9px] font-black uppercase opacity-60">36.8% Utilization</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
            <h3 className="text-white font-black text-xs uppercase tracking-widest mb-6">Service Health</h3>
            <div className="space-y-4">
              {[
                { label: 'Supabase DB', status: 'Healthy', color: 'emerald' },
                { label: 'Cloud Storage', status: 'Healthy', color: 'emerald' },
                { label: 'Auth Service', status: 'Warning', color: 'amber' },
                { label: 'Vercel Edge', status: 'Healthy', color: 'emerald' },
                { label: 'Real-time Sync', status: 'Critical', color: 'red' },
              ].map((service, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-gray-400 text-[10px] font-black uppercase tracking-tight">{service.label}</span>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[9px] font-black uppercase", `text-${service.color}-500`)}>{service.status}</span>
                    <div className={cn("w-1.5 h-1.5 rounded-full", `bg-${service.color}-500 animate-pulse`)}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const ActivityView = () => (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-white font-black text-lg uppercase tracking-tight">System-Wide Activity</h3>
              <div className="flex gap-2">
                {['All', 'Auth', 'Inventory', 'Storage', 'Settings', 'Errors'].map(cat => (
                  <Button key={cat} variant="outline" size="sm" className="bg-white/5 border-white/10 text-[9px] font-black uppercase tracking-widest hover:text-[#BF953F]">
                    {cat}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {[
                { time: '09:12 PM', event: 'ABC Store logged in', type: 'Auth', store: 'ABC Store', user: 'Juan Dela Cruz', device: 'Windows Chrome' },
                { time: '09:15 PM', event: 'New product created', type: 'Inventory', store: 'XYZ Mart', user: 'Jane Smith', device: 'Android Edge' },
                { time: '09:18 PM', event: 'User uploaded logo', type: 'Settings', store: 'Quick Stop', user: 'Bob Brown', device: 'Mac Safari' },
                { time: '09:20 PM', event: 'Storage exceeded 500MB', type: 'Storage', store: 'System', user: 'N/A', device: 'Server' },
                { time: '09:25 PM', event: 'Database backup completed', type: 'System', store: 'System', user: 'N/A', device: 'Cron Job' },
              ].map((act, i) => (
                <div 
                  key={i} 
                  className="group flex items-center gap-6 p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/5 transition-all cursor-pointer"
                  onClick={() => toast({ title: "Activity Detail", description: `${act.event} by ${act.user} on ${act.device}` })}
                >
                  <div className="text-[10px] font-black text-gray-600 w-16">{act.time}</div>
                  <div className="h-10 w-1 bg-[#BF953F]/20 rounded-full group-hover:bg-[#BF953F] transition-colors"></div>
                  <div className="flex-1">
                    <p className="text-white text-xs font-bold">{act.event}</p>
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{act.type} • {act.store}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-700 group-hover:text-white transition-colors" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="w-full md:w-80 space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
            <h3 className="text-white font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#BF953F]" />
              Usage Heatmap
            </h3>
            <div className="space-y-6">
              <div>
                <p className="text-gray-500 text-[9px] font-black uppercase tracking-widest mb-3">Peak Activity Hours</p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-[10px] font-bold text-gray-400">
                    <span>8 AM - 12 PM</span>
                    <span className="text-[#BF953F]">85% Load</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-[#BF953F] w-[85%] rounded-full"></div>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold text-gray-400">
                    <span>6 PM - 9 PM</span>
                    <span className="text-emerald-500">92% Load</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 w-[92%] rounded-full"></div>
                  </div>
                </div>
              </div>
              <div className="pt-6 border-t border-white/5">
                <p className="text-gray-500 text-[9px] font-black uppercase tracking-widest mb-2">Most Active Day</p>
                <p className="text-white text-lg font-black uppercase tracking-tighter">Friday <span className="text-gray-600 text-xs">(Payday)</span></p>
              </div>
            </div>
          </div>

          <div className="bg-[#0A0A0B] border border-white/10 rounded-[2.5rem] p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#BF953F]/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
            <h3 className="text-white font-black text-xs uppercase tracking-widest mb-4">Quick Search</h3>
            <div className="space-y-3">
              <Input placeholder="Search store..." className="bg-white/5 border-white/10 h-10 text-[10px] rounded-xl" />
              <Input placeholder="Search action..." className="bg-white/5 border-white/10 h-10 text-[10px] rounded-xl" />
              <Button className="w-full bg-white text-black font-black uppercase text-[10px] tracking-widest rounded-xl h-10">Execute Query</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const AnalyticsView = () => (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Growth Rate', value: '+24%', desc: 'New stores vs last month', icon: TrendingUp, color: 'emerald' },
          { label: 'Retention', value: '94.2%', desc: 'Active users over 30 days', icon: Activity, color: 'blue' },
          { label: 'Daily Active', value: '41', desc: 'Stores online today', icon: Globe, color: 'purple' },
          { label: 'Avg Storage', value: '350 MB', desc: 'Per store database size', icon: Database, color: 'amber' },
        ].map((kpi, i) => (
          <Card key={i} className="bg-white/5 border-white/10 p-6 rounded-[2rem] hover:bg-white/[0.07] transition-all">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4", `bg-${kpi.color}-500/10`)}>
              <kpi.icon className={cn("w-5 h-5", `text-${kpi.color}-500`)} />
            </div>
            <p className="text-gray-500 text-[9px] font-black uppercase tracking-widest mb-1">{kpi.label}</p>
            <p className="text-2xl font-black text-white tracking-tighter mb-1">{kpi.value}</p>
            <p className="text-[8px] font-bold text-gray-600 uppercase">{kpi.desc}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 bg-white/5 border border-white/10 rounded-[2.5rem] p-10">
          <div className="flex items-center justify-between mb-10">
            <h3 className="text-white font-black text-lg uppercase tracking-tight">Growth Projection</h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#BF953F]"></div>
                <span className="text-[9px] font-black text-gray-500 uppercase">Stores</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span className="text-[9px] font-black text-gray-500 uppercase">Revenue</span>
              </div>
            </div>
          </div>
          <div className="h-64 flex items-end gap-3 px-2">
            {[10, 18, 25, 40, 52, 68, 85].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-4">
                <div className="w-full flex gap-1">
                  <motion.div initial={{ height: 0 }} animate={{ height: `${h}%` }} className="flex-1 bg-[#BF953F]/40 hover:bg-[#BF953F] transition-all rounded-t-lg" />
                  <motion.div initial={{ height: 0 }} animate={{ height: `${h * 0.7}%` }} className="flex-1 bg-blue-500/40 hover:bg-blue-500 transition-all rounded-t-lg" />
                </div>
                <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Month {i+1}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
            <h3 className="text-white font-black text-xs uppercase tracking-widest mb-6">Geographic Distribution</h3>
            <div className="space-y-4">
              {[
                { city: 'Cebu', share: '35%', color: '#BF953F' },
                { city: 'Manila', share: '25%', color: '#3B82F6' },
                { city: 'Davao', share: '15%', color: '#A855F7' },
                { city: 'Others', share: '25%', color: '#6B7280' },
              ].map((loc, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase">
                    <span className="text-gray-400">{loc.city}</span>
                    <span className="text-white">{loc.share}</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: loc.share, backgroundColor: loc.color }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 text-center">
            <h3 className="text-white font-black text-xs uppercase tracking-widest mb-6">Device Analytics</h3>
            <div className="relative w-32 h-32 mx-auto mb-6">
               <div className="absolute inset-0 border-8 border-white/5 rounded-full"></div>
               <div className="absolute inset-0 border-8 border-[#BF953F] rounded-full" style={{ clipPath: 'polygon(50% 50%, 50% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 50%)' }}></div>
               <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-black text-white">70%</span>
               </div>
            </div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Desktop Preference</p>
          </div>
        </div>
      </div>
    </div>
  );

  const SecurityView = () => (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white/5 border-white/10 p-8 rounded-[2.5rem] relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 blur-2xl"></div>
          <h3 className="text-gray-500 text-[9px] font-black uppercase tracking-widest mb-4">Security Score</h3>
          <p className="text-5xl font-black text-emerald-500 tracking-tighter mb-2">87<span className="text-lg text-gray-600">/100</span></p>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Status: Robust</span>
          </div>
        </Card>

        <Card className="bg-white/5 border-white/10 p-8 rounded-[2.5rem]">
          <h3 className="text-gray-500 text-[9px] font-black uppercase tracking-widest mb-6">Login Monitoring</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-white text-[11px] font-black uppercase tracking-tight">Successful</span>
              <span className="text-emerald-500 font-black">1,420</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white text-[11px] font-black uppercase tracking-tight">Failed Attempts</span>
              <span className="text-amber-500 font-black">42</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white text-[11px] font-black uppercase tracking-tight">Blocked IPs</span>
              <span className="text-red-500 font-black">12</span>
            </div>
          </div>
        </Card>

        <Card className="bg-white/5 border-white/10 p-8 rounded-[2.5rem]">
          <h3 className="text-gray-500 text-[9px] font-black uppercase tracking-widest mb-6">Suspicious Events</h3>
          <div className="space-y-3">
             {[
               { alert: 'Multiple Device Login', store: 'ABC Store', severity: 'low' },
               { alert: 'Unusual Access Location', store: 'Quick Stop', severity: 'medium' },
               { alert: 'Storage Abuse Detected', store: 'XYZ Mart', severity: 'high' },
             ].map((alert, i) => (
               <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/[0.05]">
                 <div>
                   <p className="text-white text-[10px] font-black uppercase tracking-tight">{alert.alert}</p>
                   <p className="text-[8px] font-bold text-gray-500 uppercase">{alert.store}</p>
                 </div>
                 <div className={cn("w-2 h-2 rounded-full", alert.severity === 'high' ? 'bg-red-500' : alert.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500')}></div>
               </div>
             ))}
          </div>
        </Card>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden">
        <div className="p-8 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-white font-black text-lg uppercase tracking-tight">Active Terminal Sessions</h3>
          <Button variant="outline" size="sm" className="bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white">Global Force Logout</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/[0.02]">
                <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Store Entity</th>
                <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Terminal / Browser</th>
                <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Network Origin</th>
                <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Session Start</th>
                <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[
                { store: 'ABC Store', device: 'Windows PC', browser: 'Chrome 124', ip: '112.198.xxx.xxx', start: '2 hours ago' },
                { store: 'XYZ Mart', device: 'Android Tablet', browser: 'Edge Mobile', ip: '49.145.xxx.xxx', start: '15 mins ago' },
                { store: 'Local Fresh', device: 'iPad Air', browser: 'Safari', ip: '120.28.xxx.xxx', start: 'Just now' },
              ].map((session, i) => (
                <tr key={i} className="hover:bg-white/[0.03] transition-all">
                  <td className="p-6">
                    <p className="text-white text-sm font-bold uppercase tracking-tight">{session.store}</p>
                  </td>
                  <td className="p-6">
                    <p className="text-gray-400 text-[10px] font-black uppercase">{session.device} • {session.browser}</p>
                  </td>
                  <td className="p-6">
                    <p className="text-gray-500 font-mono text-[10px]">{session.ip}</p>
                  </td>
                  <td className="p-6 text-gray-400 text-[10px] font-bold uppercase tracking-widest">{session.start}</td>
                  <td className="p-6 text-right space-x-2">
                    <Button variant="ghost" size="sm" className="text-amber-500 hover:bg-amber-500/10">Terminate</Button>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-500/10">Blacklist</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const AIView = () => (
    <div className="space-y-8">
      <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#BF953F]/5 rounded-full -mr-32 -mt-32 blur-[100px]"></div>
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
            <div className="flex-1 space-y-6">
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             {[
               'Show inactive stores',
               'Are there any system issues?',
               'Predict storage growth',
             ].map((q, i) => (
               <Button key={i} variant="ghost" className="h-12 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl border border-white/5">
                 {q}
               </Button>
             ))}
          </div>
        </div>
      </div>
    </div>
  );

  const UsageView = () => (
    <div className="space-y-8">
      <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10">
        <h3 className="text-white font-black text-xl uppercase tracking-tight mb-8">Module Adoption Rate</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { label: 'Inventory Module', usage: '95%', active: '49 Stores', color: '#BF953F' },
            { label: 'Reports Module', usage: '80%', active: '41 Stores', color: '#3B82F6' },
            { label: 'AI Assistant', usage: '20%', active: '10 Stores', color: '#A855F7' },
            { label: 'Cloud Print', usage: '12%', active: '6 Stores', color: '#6B7280' },
          ].map((mod, i) => (
            <div key={i} className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-white font-black text-sm uppercase tracking-tight">{mod.label}</p>
                  <p className="text-[9px] font-bold text-gray-500 uppercase">{mod.active}</p>
                </div>
                <span className="text-xl font-black text-white">{mod.usage}</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: mod.usage, backgroundColor: mod.color }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const SubscriptionsView = () => (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Trial Users', value: '12', color: 'blue' },
          { label: 'Premium Accounts', value: '34', color: 'emerald' },
          { label: 'Expired', value: '6', color: 'red' },
          { label: 'MRR', value: '₱184,200', color: 'amber' },
        ].map((sub, i) => (
          <Card key={i} className="bg-white/5 border-white/10 p-8 rounded-[2.5rem] hover:bg-white/[0.07] transition-all">
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">{sub.label}</p>
            <p className="text-2xl font-black text-white tracking-tighter">{sub.value}</p>
          </Card>
        ))}
      </div>
    </div>
  );

  const ClientsView = () => (
    <div className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden">
      <div className="p-8 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-white font-black text-lg uppercase tracking-tight">Managed Ecosystem</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="bg-white/5 border-white/10 text-gray-400 hover:text-white">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline" size="sm" className="bg-white/5 border-white/10 text-gray-400 hover:text-white">
            Export CSV
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        {clientsLoading ? (
          <div className="p-20 text-center text-gray-500 font-black uppercase tracking-widest animate-pulse">Synchronizing client registry...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.02]">
                <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Store Entity</th>
                <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Ownership</th>
                <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Access Status</th>
                <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Data Weight</th>
                <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Subscription</th>
                <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(clients || []).map((client: any) => (
                <tr key={client.id} className="hover:bg-white/[0.03] transition-all group cursor-pointer">
                  <td className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-[#BF953F]/20 transition-colors">
                        <Globe className="w-5 h-5 text-gray-500 group-hover:text-[#BF953F]" />
                      </div>
                      <div>
                        <p className="text-white font-bold text-sm">{client.storeName}</p>
                        <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest">ID: {client.id.substring(0, 8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    <p className="text-gray-400 text-xs font-bold">{client.ownerName}</p>
                    <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest">{client.email}</p>
                  </td>
                  <td className="p-6">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-1.5 h-1.5 rounded-full", client.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-600')}></div>
                      <span className={cn("text-[10px] font-black uppercase tracking-widest", client.status === 'online' ? 'text-emerald-500' : 'text-gray-600')}>
                        {client.status}
                      </span>
                    </div>
                  </td>
                  <td className="p-6">
                    <p className="text-white text-xs font-black">{client.storageUsed}</p>
                  </td>
                  <td className="p-6">
                    <span className={cn(
                      "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest",
                      client.subscription === 'Enterprise' ? 'bg-purple-500/10 text-purple-500' :
                      client.subscription === 'Pro' ? 'bg-[#BF953F]/10 text-[#BF953F]' : 'bg-blue-500/10 text-blue-500'
                    )}>
                      {client.subscription}
                    </span>
                  </td>
                  <td className="p-6 text-right">
                    <Button variant="ghost" size="icon" className="text-gray-500 hover:text-white">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  const SupabaseView = () => (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-white/5 border-white/10 p-8 rounded-[2.5rem]">
          <h3 className="text-white font-black text-xs uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
            <Database className="w-4 h-4 text-[#BF953F]" />
            Database Stats
          </h3>
          <div className="space-y-6">
            {[
              { label: 'Total Tables', value: '14' },
              { label: 'Total Rows', value: '842,501' },
              { label: 'DB Size', value: '1.42 GB' },
              { label: 'Active Connections', value: '42' },
            ].map((stat, i) => (
              <div key={i} className="flex justify-between items-center pb-4 border-b border-white/5 last:border-0">
                <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{stat.label}</span>
                <span className="text-white text-sm font-black">{stat.value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="bg-white/5 border-white/10 p-8 rounded-[2.5rem]">
          <h3 className="text-white font-black text-xs uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
            <Server className="w-4 h-4 text-[#BF953F]" />
            Storage usage
          </h3>
          <div className="space-y-6">
            {[
              { label: 'Uploaded Images', value: '12.4 GB' },
              { label: 'System Backups', value: '4.2 GB' },
              { label: 'Audit Logs', value: '1.8 GB' },
              { label: 'Bucket Count', value: '5' },
            ].map((stat, i) => (
              <div key={i} className="flex justify-between items-center pb-4 border-b border-white/5 last:border-0">
                <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{stat.label}</span>
                <span className="text-white text-sm font-black">{stat.value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="bg-white/5 border-white/10 p-8 rounded-[2.5rem]">
          <h3 className="text-white font-black text-xs uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#BF953F]" />
            Authentication
          </h3>
          <div className="space-y-6">
            {[
              { label: 'Registered Users', value: '254' },
              { label: 'Logins Today', value: '82' },
              { label: 'Failed Attempts', value: '5' },
              { label: 'Active Sessions', value: '18' },
            ].map((stat, i) => (
              <div key={i} className="flex justify-between items-center pb-4 border-b border-white/5 last:border-0">
                <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{stat.label}</span>
                <span className="text-white text-sm font-black">{stat.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-white font-black text-lg uppercase tracking-tight">Supabase API Metrics</h3>
          <div className="flex gap-2">
             <div className="px-3 py-1 bg-emerald-500/10 rounded-lg text-emerald-500 text-[8px] font-black uppercase tracking-widest">REST: 12ms avg</div>
             <div className="px-3 py-1 bg-emerald-500/10 rounded-lg text-emerald-500 text-[8px] font-black uppercase tracking-widest">Auth: 45ms avg</div>
          </div>
        </div>
        <div className="h-48 flex items-end gap-2 px-2">
          {Array.from({ length: 40 }).map((_, i) => (
            <motion.div 
              key={i}
              initial={{ height: 0 }}
              animate={{ height: `${Math.random() * 80 + 20}%` }}
              className="flex-1 bg-[#BF953F]/20 hover:bg-[#BF953F] transition-colors rounded-t-sm"
            />
          ))}
        </div>
        <div className="flex justify-between mt-4 px-2">
          <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">00:00 AM</span>
          <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">12:00 PM</span>
          <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Current Time</span>
        </div>
      </div>
    </div>
  );

  const ReleasesView = () => (
    <div className="space-y-8">
      <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10">
        <h3 className="text-white font-black text-xl uppercase tracking-tight mb-8">Deployment History</h3>
        <div className="space-y-6">
          {[
            { version: '2.0.1', date: 'June 8, 2026', status: 'Production', notes: 'Implemented Developer Console and advanced monitoring.' },
            { version: '2.0.0', date: 'June 1, 2026', status: 'Legacy', notes: 'Major UI overhaul and inventory V2 rollout.' },
            { version: '1.9.5', date: 'May 15, 2026', status: 'Archived', notes: 'Fix: Database synchronization latency issues.' },
          ].map((rel, i) => (
            <div key={i} className="flex gap-6 p-6 rounded-3xl bg-white/[0.02] border border-white/[0.05]">
              <div className="flex-none">
                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center">
                  <Rocket className="w-6 h-6 text-[#BF953F]" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-white font-black text-lg">Version {rel.version}</h4>
                  <span className={cn(
                    "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest",
                    rel.status === 'Production' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-gray-500/10 text-gray-500'
                  )}>
                    {rel.status}
                  </span>
                </div>
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-3">{rel.date}</p>
                <p className="text-gray-400 text-xs leading-relaxed">{rel.notes}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const DatabaseExplorerView = () => (
    <div className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden">
      <div className="p-8 border-b border-white/5">
        <h3 className="text-white font-black text-lg uppercase tracking-tight">Database Schema Explorer</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-white/[0.02]">
              <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Table Name</th>
              <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Rows</th>
              <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Size</th>
              <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Last Modified</th>
              <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono">
            {[
              { name: 'sales', rows: '42,102', size: '124 MB', last: '2 mins ago' },
              { name: 'products', rows: '1,204', size: '15 MB', last: '1 hour ago' },
              { name: 'staff', rows: '124', size: '2 MB', last: '5 days ago' },
              { name: 'expenses', rows: '8,402', size: '42 MB', last: '12 hours ago' },
            ].map((table, i) => (
              <tr key={i} className="hover:bg-white/[0.03] transition-all">
                <td className="p-6 text-white text-xs font-bold uppercase">{table.name}</td>
                <td className="p-6 text-gray-400 text-xs">{table.rows}</td>
                <td className="p-6 text-gray-400 text-xs">{table.size}</td>
                <td className="p-6 text-gray-400 text-xs">{table.last}</td>
                <td className="p-6 text-right">
                  <Button variant="ghost" size="sm" className="text-[#BF953F] hover:bg-[#BF953F]/10">Query</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const SettingsView = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-10">
      <div className="space-y-8">
        <section className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
          <h3 className="text-white font-black text-xs uppercase tracking-[0.2em] mb-8">General System</h3>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-gray-500 text-[9px] font-black uppercase tracking-widest ml-1">Platform Name</label>
              <Input defaultValue="SmartPOS+ Ecosystem" className="bg-white/5 border-white/10 h-12 rounded-xl text-white font-bold" />
            </div>
            <div className="space-y-2">
              <label className="text-gray-500 text-[9px] font-black uppercase tracking-widest ml-1">Version Identity</label>
              <Input defaultValue="V2.0.1-Stable" className="bg-white/5 border-white/10 h-12 rounded-xl text-white font-bold" disabled />
            </div>
          </div>
        </section>

        <section className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
          <h3 className="text-white font-black text-xs uppercase tracking-[0.2em] mb-8">Developer Visibility</h3>
          <div className="space-y-6">
             <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5">
                <div>
                   <p className="text-white text-xs font-bold uppercase tracking-tight">Access Visibility</p>
                   <p className="text-[9px] font-black text-gray-500 uppercase">Current: Secret Corner</p>
                </div>
                <Button variant="outline" className="h-10 bg-white/5 border-white/10 text-[10px] font-black uppercase tracking-widest">Change</Button>
             </div>
             <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5">
                <div>
                   <p className="text-white text-xs font-bold uppercase tracking-tight">Entry Point</p>
                   <p className="text-[9px] font-black text-gray-500 uppercase">5x Logo Click</p>
                </div>
                <Button variant="outline" className="h-10 bg-white/5 border-white/10 text-[10px] font-black uppercase tracking-widest">Toggle</Button>
             </div>
          </div>
        </section>
      </div>

      <div className="space-y-8">
        <section className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
          <h3 className="text-white font-black text-xs uppercase tracking-[0.2em] mb-8">External Integrations</h3>
          <div className="space-y-4">
             {[
               { name: 'Supabase Cloud', status: 'Connected', color: 'emerald' },
               { name: 'OpenAI GPT-4', status: 'Connected', color: 'emerald' },
               { name: 'Twilio SMS API', status: 'Disconnected', color: 'red' },
               { name: 'SendGrid Email', status: 'Warning', color: 'amber' },
             ].map((api, i) => (
               <div key={i} className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5">
                 <span className="text-white text-[10px] font-black uppercase tracking-widest">{api.name}</span>
                 <div className="flex items-center gap-2">
                   <span className={cn("text-[8px] font-black uppercase", `text-${api.color}-500`)}>{api.status}</span>
                   <div className={cn("w-1.5 h-1.5 rounded-full", `bg-${api.color}-500`)}></div>
                 </div>
               </div>
             ))}
          </div>
        </section>

        <section className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
          <h3 className="text-white font-black text-xs uppercase tracking-[0.2em] mb-8">Maintenance & Backups</h3>
          <div className="space-y-4">
            <Button className="w-full h-12 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border-none font-black uppercase text-[10px] tracking-widest rounded-xl transition-all">
               Enable Maintenance Mode
            </Button>
            <Button className="w-full h-12 bg-white/5 text-white border-white/10 font-black uppercase text-[10px] tracking-widest rounded-xl transition-all">
               Trigger Daily Backup
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
  const HealthView = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10">
        <h3 className="text-white font-black text-xl uppercase tracking-tight mb-8">Server Infrastructure</h3>
        <div className="space-y-8">
          {[
            { label: 'CPU Utilization', value: '14%', icon: Cpu, color: 'blue' },
            { label: 'Memory Usage', value: '2.4 GB / 8 GB', icon: Zap, color: 'purple' },
            { label: 'Network Latency', value: '18ms', icon: Wifi, color: 'emerald' },
            { label: 'Process Count', value: '42 Active', icon: Activity, color: 'amber' },
          ].map((item, i) => (
            <div key={i} className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <item.icon className={cn("w-5 h-5", `text-${item.color}-500`)} />
                  <span className="text-gray-400 text-xs font-bold">{item.label}</span>
                </div>
                <span className="text-white text-xs font-black">{item.value}</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full", `bg-${item.color}-500`)} style={{ width: i === 0 ? '14%' : i === 1 ? '30%' : '100%' }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10">
        <h3 className="text-white font-black text-xl uppercase tracking-tight mb-8">System Warnings</h3>
        <div className="space-y-4">
          {[
            { title: 'Auth Token Latency', desc: 'Authentication requests are taking longer than 200ms in Southeast Asia.', severity: 'medium' },
            { title: 'Disk Cache 85%', desc: 'Temporary storage cache is nearly full on Node-04 instance.', severity: 'high' },
            { title: 'New Version Detected', desc: 'Vite build 2.0.2 is ready for production rollout.', severity: 'low' },
          ].map((alert, i) => (
            <div key={i} className={cn(
              "p-6 rounded-2xl border flex gap-4",
              alert.severity === 'high' ? 'bg-red-500/5 border-red-500/20' : 
              alert.severity === 'medium' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-blue-500/5 border-blue-500/20'
            )}>
              <AlertTriangle className={cn(
                "w-6 h-6 flex-none",
                alert.severity === 'high' ? 'text-red-500' : 
                alert.severity === 'medium' ? 'text-amber-500' : 'text-blue-500'
              )} />
              <div>
                <h4 className="text-white font-bold text-sm mb-1">{alert.title}</h4>
                <p className="text-gray-500 text-xs leading-relaxed">{alert.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const LogsView = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-black text-lg uppercase tracking-tight">Active Error Monitoring</h3>
        <Button variant="outline" size="sm" className="bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white">Clear All Logs</Button>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.02]">
                <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Error Event</th>
                <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Stack Origin</th>
                <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Timestamp</th>
                <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">User Entity</th>
                <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {[
                { event: 'ReferenceError: x is not defined', loc: 'scanner-sales.tsx:124', time: '2026-06-09 21:42', user: 'ABC Store', status: 'unresolved' },
                { event: 'API_FETCH_FAILED (500)', loc: '/api/sync-staff', time: '2026-06-09 21:38', user: 'XYZ Mart', status: 'resolved' },
                { event: 'Auth_Token_Expired', loc: 'AuthContext.tsx:52', time: '2026-06-09 21:35', user: 'Quick Stop', status: 'unresolved' },
                { event: 'Database_Timeout (10s)', loc: 'database.ts:882', time: '2026-06-09 21:30', user: 'System', status: 'resolved' },
              ].map((log, i) => (
                <tr key={i} className="hover:bg-white/[0.03] transition-all group">
                  <td className="p-6">
                    <p className="text-red-400 text-xs font-bold">{log.event}</p>
                  </td>
                  <td className="p-6">
                    <p className="text-gray-500 text-[10px]">{log.loc}</p>
                  </td>
                  <td className="p-6 text-gray-400 text-[10px]">{log.time}</td>
                  <td className="p-6 text-white text-[10px] uppercase font-black">{log.user}</td>
                  <td className="p-6 text-right">
                    <span className={cn(
                      "px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest",
                      log.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                    )}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const FlagsView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[
        { name: 'Inventory Module V2', desc: 'Enable advanced stock tracking and low-stock alerts.', active: true },
        { name: 'AI Business Assistant', desc: 'Allow users to query sales data using natural language.', active: false },
        { name: 'Online Ordering System', desc: 'Enable customer-facing web portal for direct orders.', active: true },
        { name: 'Thermal Cloud Print', desc: 'Support printing to network printers via cloud bridge.', active: false },
        { name: 'Multi-Tenant Auth', desc: 'Allow single user to manage multiple business entities.', active: true },
        { name: 'Dark Mode Theme', desc: 'Global theme switcher for administrator dashboard.', active: true },
      ].map((flag, i) => (
        <Card key={i} className="bg-white/5 border-white/10 p-8 rounded-[2.5rem] hover:bg-white/[0.07] transition-all">
          <div className="flex justify-between items-start mb-6">
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center bg-white/5")}>
              <Flag className={cn("w-6 h-6", flag.active ? "text-[#BF953F]" : "text-gray-600")} />
            </div>
            <div className={cn(
              "w-12 h-6 rounded-full relative cursor-pointer transition-all p-1",
              flag.active ? "bg-[#BF953F]" : "bg-white/10"
            )}>
              <div className={cn(
                "w-4 h-4 bg-white rounded-full transition-all shadow-sm",
                flag.active ? "translate-x-6" : "translate-x-0"
              )}></div>
            </div>
          </div>
          <h4 className="text-white font-black text-sm uppercase tracking-tight mb-2">{flag.name}</h4>
          <p className="text-gray-500 text-[10px] leading-relaxed font-medium">{flag.desc}</p>
        </Card>
      ))}
    </div>
  );

  const ToolsView = () => (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Clear Cache', desc: 'Purge global CDN and local edge caches.', icon: Zap },
          { label: 'Maintenance Mode', desc: 'Restrict all user access for system updates.', icon: ShieldCheck },
          { label: 'Refresh Sessions', desc: 'Force logout all active user sessions.', icon: Lock },
          { label: 'Database Backup', desc: 'Trigger manual snapshot of production DB.', icon: Database },
        ].map((tool, i) => (
          <Button key={i} variant="outline" className="h-40 flex flex-col items-center justify-center gap-4 bg-white/5 border-white/10 rounded-[2.5rem] hover:bg-white/10 group transition-all">
            <tool.icon className="w-8 h-8 text-gray-500 group-hover:text-[#BF953F] transition-colors" />
            <div className="text-center">
              <span className="block text-white font-black text-xs uppercase tracking-widest mb-1">{tool.label}</span>
              <span className="text-gray-600 text-[9px] font-medium max-w-[120px] block">{tool.desc}</span>
            </div>
          </Button>
        ))}
      </div>

      <Card className="bg-white/5 border-white/10 p-8 rounded-[2.5rem]">
        <h3 className="text-white font-black text-lg uppercase tracking-tight mb-6">Broadcast Announcement</h3>
        <div className="space-y-4">
          <textarea 
            placeholder="Type your message to all stores..."
            className="w-full h-32 bg-white/5 border-white/10 rounded-2xl p-6 text-white text-sm font-bold focus:ring-[#BF953F]/20 focus:border-[#BF953F]/50 outline-none transition-all"
          />
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="w-4 h-4 rounded border border-white/20 bg-white/5 group-hover:border-[#BF953F] transition-all"></div>
                <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Push Notify</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="w-4 h-4 rounded border border-white/20 bg-white/5 group-hover:border-[#BF953F] transition-all"></div>
                <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Email Blast</span>
              </label>
            </div>
            <Button className="bg-[#BF953F] text-black font-black uppercase tracking-widest px-8 rounded-xl h-12">Broadcast Now</Button>
          </div>
        </div>
      </Card>
    </div>
  );

  const LiveMonitoringView = () => (
    <div className="space-y-8">
      <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h3 className="text-white font-black text-xl uppercase tracking-tight">Active Terminal Flux</h3>
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mt-1">Real-time connection monitoring</p>
          </div>
          <div className="flex gap-4">
             <div className="text-center">
                <p className="text-emerald-500 text-xl font-black">18</p>
                <p className="text-[8px] font-black text-gray-600 uppercase">Online</p>
             </div>
             <div className="w-px h-10 bg-white/5"></div>
             <div className="text-center">
                <p className="text-gray-500 text-xl font-black">34</p>
                <p className="text-[8px] font-black text-gray-600 uppercase">Offline</p>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(clients || []).map((client: any, i: number) => (
            <div key={i} className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/[0.05] hover:border-[#BF953F]/20 transition-all group">
              <div className="flex justify-between items-start mb-6">
                <div className={cn("w-2 h-2 rounded-full", client.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-700')}></div>
                <div className="text-right">
                   <p className="text-white font-black text-xs uppercase tracking-tight">{client.storeName}</p>
                   <p className="text-[8px] font-bold text-gray-500 uppercase">{client.ownerName}</p>
                </div>
              </div>
              <div className="space-y-3 pt-4 border-t border-white/5">
                 <div className="flex justify-between text-[9px] font-black uppercase tracking-widest">
                    <span className="text-gray-600">Terminal</span>
                    <span className="text-gray-400">{client.deviceType}</span>
                 </div>
                 <div className="flex justify-between text-[9px] font-black uppercase tracking-widest">
                    <span className="text-gray-600">Last Seen</span>
                    <span className="text-gray-400">{client.lastActive}</span>
                 </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0A0B] flex font-sans overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className={cn(
        "flex-1 flex flex-col h-screen transition-all duration-500",
        isSidebarCollapsed ? "ml-20" : "ml-72"
      )}>
        <div className="p-10 overflow-y-auto flex-1 custom-scrollbar">
          <Header />

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {activeTab === 'dashboard' && <DashboardView />}
              {activeTab === 'clients' && <ClientsView />}
              {activeTab === 'live' && <LiveMonitoringView />}
              {activeTab === 'activity' && <ActivityView />}
              {activeTab === 'analytics' && <AnalyticsView />}
              {activeTab === 'security' && <SecurityView />}
              {activeTab === 'ai' && <AIView />}
              {activeTab === 'usage' && <UsageView />}
              {activeTab === 'subscriptions' && <SubscriptionsView />}
              {activeTab === 'supabase' && <SupabaseView />}
              {activeTab === 'health' && <HealthView />}
              {activeTab === 'logs' && <LogsView />}
              {activeTab === 'releases' && <ReleasesView />}
              {activeTab === 'db_explorer' && <DatabaseExplorerView />}
              {activeTab === 'settings' && <SettingsView />}
              {activeTab === 'tools' && <ToolsView />}
              
              {/* Fallback for other tabs */}
              {!['dashboard', 'clients', 'live', 'activity', 'analytics', 'security', 'ai', 'usage', 'subscriptions', 'supabase', 'health', 'logs', 'releases', 'db_explorer', 'settings', 'tools'].includes(activeTab) && (
                <div className="flex flex-col items-center justify-center py-40 opacity-20 grayscale">
                  <Code2 className="w-20 h-20 text-gray-400 mb-6" />
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Module Under Development</h3>
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-2">Console access limited to core monitoring systems</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Collapse Toggle */}
      <button
        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        className="fixed bottom-10 left-[268px] z-[60] w-8 h-8 bg-[#BF953F] rounded-full flex items-center justify-center text-black hover:scale-110 active:scale-95 transition-all shadow-lg shadow-[#BF953F]/20"
        style={{ left: isSidebarCollapsed ? '64px' : '268px' }}
      >
        <ChevronRight className={cn("w-5 h-5 transition-transform duration-500", !isSidebarCollapsed && "rotate-180")} />
      </button>
    </div>
  );
};

export default DeveloperConsole;
