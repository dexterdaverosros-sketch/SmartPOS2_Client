import React, { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { useLocation } from "wouter";
import { 
  ArrowLeft, 
  User as UserIcon, 
  Users, 
  Search, 
  Filter, 
  Calendar, 
  Bell, 
  ChevronRight, 
  MessageCircle, 
  Smartphone, 
  Phone,
  CreditCard,
  TrendingUp,
  UserPlus,
  ArrowUpRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreditorService } from "@/lib/db";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useDevices } from "@/contexts/DeviceContext";

export default function LedgerPage() {
  const [, setLocation] = useLocation();
  const { deviceMode } = useDevices();
  const [search, setSearch] = useState("");
  const [sortAZ, setSortAZ] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [creditors, setCreditors] = useState<Array<{ id: string; name: string; amount: number; isPaid: boolean }>>([]);
  
  const isDesktop = deviceMode === 'pc' || deviceMode === 'tablet';

  useEffect(() => {
    (async () => {
      const rows = await CreditorService.getAllCreditors();
      setCreditors(rows.map(r => ({ id: r.id, name: r.name, amount: r.amount || 0, isPaid: !!r.isPaid })));
    })();
  }, []);

  const filtered = useMemo(() => {
    let list = creditors.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
    if (statusFilter !== 'all') list = list.filter(c => (statusFilter === 'paid' ? c.isPaid : !c.isPaid));
    list.sort((a, b) => sortAZ ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
    return list;
  }, [creditors, search, sortAZ, statusFilter]);

  const totalBalance = useMemo(() => creditors.reduce((s, c) => s + (c.isPaid ? 0 : c.amount), 0), [creditors]);
  const totalCreditorsCount = creditors.length;
  const totalPayments = useMemo(() => creditors.filter(c => c.isPaid).reduce((s, c) => s + c.amount, 0), [creditors]);

  const formatCurrency = (v: number) => {
    try { return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v); }
    catch { return `₱${v.toFixed(2)}`; }
  };

  const [isCredPopupOpen, setIsCredPopupOpen] = useState(false);
  const [remindCreditorId, setRemindCreditorId] = useState<string | null>(null);
  const [isRemindOpen, setIsRemindOpen] = useState(false);

  return (
    <Layout showNavigation={false}>
      <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
        {/* Modern Header */}
        <div className="bg-slate-900 pt-8 pb-12 px-6 rounded-b-[3rem] relative overflow-hidden flex-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#BF953F]/10 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-24 -mb-24 blur-2xl" />
          
          <div className="max-w-7xl mx-auto w-full relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setLocation('/admin-main')}
                  className="w-10 h-10 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                  <p className="text-[#BF953F] text-[10px] font-black uppercase tracking-[0.3em]">Financials</p>
                  <h1 className="text-2xl font-black text-white tracking-tighter uppercase">Credit Ledger</h1>
                </div>
              </div>
              <Button 
                onClick={() => setIsCredPopupOpen(true)}
                className="bg-[#BF953F] hover:bg-[#B38728] text-white rounded-2xl px-6 h-12 font-black text-[10px] uppercase tracking-widest shadow-xl shadow-[#BF953F]/20 transition-all"
              >
                <Users className="w-4 h-4 mr-2" />
                All Creditors
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/10 backdrop-blur-md border border-white/10 p-4 rounded-[2rem] flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <p className="text-white/40 text-[9px] font-black uppercase tracking-widest">Outstanding Balance</p>
                  <p className="text-xl font-black text-white">{formatCurrency(totalBalance)}</p>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-md border border-white/10 p-4 rounded-[2rem] flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-white/40 text-[9px] font-black uppercase tracking-widest">Total Creditors</p>
                  <p className="text-xl font-black text-white">{totalCreditorsCount}</p>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-md border border-white/10 p-4 rounded-[2rem] flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-white/40 text-[9px] font-black uppercase tracking-widest">Total Collected</p>
                  <p className="text-xl font-black text-white">{formatCurrency(totalPayments)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 max-w-7xl mx-auto w-full p-6 flex flex-col min-h-0">
          <div className="flex flex-col md:flex-row gap-6 h-full">
            {/* Left Column: Search & Filters */}
            <div className={cn(
              "flex-none flex flex-col gap-4",
              isDesktop ? "w-80" : "w-full"
            )}>
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 flex items-center gap-2">
                  <Filter className="w-3 h-3" />
                  Management Tools
                </h2>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Search Account</label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input 
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Name or ID..."
                        className="pl-12 h-12 bg-slate-50 border-none rounded-2xl font-bold text-sm focus:ring-2 focus:ring-[#BF953F]/20"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setSortAZ(!sortAZ)}
                      className="h-12 rounded-xl border-slate-100 text-[10px] font-black uppercase tracking-widest"
                    >
                      Sort: {sortAZ ? 'A-Z' : 'Z-A'}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setLocation('/ledger/add-customer')}
                      className="h-12 rounded-xl bg-slate-900 text-white border-none text-[10px] font-black uppercase tracking-widest"
                    >
                      <UserPlus className="w-3.5 h-3.5 mr-2" />
                      Add
                    </Button>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex-1 overflow-hidden flex flex-col">
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 flex items-center gap-2">
                  <Calendar className="w-3 h-3" />
                  Filter Status
                </h2>
                <div className="space-y-2">
                  {[
                    { id: 'all', label: 'All Accounts', icon: Users },
                    { id: 'unpaid', label: 'Outstanding', icon: CreditCard },
                    { id: 'paid', label: 'Fully Paid', icon: TrendingUp }
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setStatusFilter(item.id as any)}
                      className={cn(
                        "w-full flex items-center justify-between p-4 rounded-2xl border transition-all",
                        statusFilter === item.id 
                          ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/10" 
                          : "bg-white text-slate-500 border-slate-50 hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className={cn("w-4 h-4", statusFilter === item.id ? "text-[#BF953F]" : "text-slate-400")} />
                        <span className="text-[11px] font-black uppercase tracking-tight">{item.label}</span>
                      </div>
                      {statusFilter === item.id && <div className="w-1.5 h-1.5 rounded-full bg-[#BF953F]" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Ledger List */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 flex-1 flex flex-col overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex items-center justify-between flex-none">
                  <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900">
                    Active Accounts <span className="text-slate-400 ml-2">({filtered.length})</span>
                  </h2>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg text-slate-400"><Calendar className="w-4 h-4" /></Button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filtered.map((creditor) => (
                      <motion.div 
                        key={creditor.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => setLocation(`/admin/creditors/${creditor.id}`)}
                        className="bg-slate-50/50 hover:bg-white p-5 rounded-3xl border border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 transition-all cursor-pointer group"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 group-hover:border-[#BF953F]/30 transition-colors overflow-hidden">
                              <UserIcon className="w-6 h-6 text-slate-400 group-hover:text-[#BF953F]" />
                            </div>
                            <div>
                              <h3 className="font-black text-xs uppercase tracking-tight text-slate-900">{creditor.name}</h3>
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">ID: {creditor.id.substring(0, 8)}</p>
                            </div>
                          </div>
                          <div className={cn(
                            "px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest",
                            creditor.isPaid 
                              ? "bg-emerald-500/10 text-emerald-500" 
                              : "bg-red-500/10 text-red-500"
                          )}>
                            {creditor.isPaid ? 'Settled' : 'Pending'}
                          </div>
                        </div>
                        
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Balance Due</p>
                            <p className={cn(
                              "text-xl font-black tracking-tighter",
                              creditor.isPaid ? "text-slate-400" : "text-slate-900"
                            )}>
                              {formatCurrency(creditor.amount)}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="w-10 h-10 rounded-xl bg-white border border-slate-100 group-hover:border-[#BF953F]/30"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRemindCreditorId(creditor.id);
                                setIsRemindOpen(true);
                              }}
                            >
                              <Bell className="w-4 h-4 text-slate-400 group-hover:text-[#BF953F]" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="w-10 h-10 rounded-xl bg-slate-900 text-white"
                            >
                              <ArrowUpRight className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                    
                    {filtered.length === 0 && (
                      <div className="col-span-full py-20 flex flex-col items-center justify-center text-center opacity-40">
                        <div className="w-20 h-20 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-4 border border-slate-100">
                          <Users className="w-8 h-8 text-slate-300" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em]">No Accounts Found</p>
                        <p className="text-[8px] font-bold uppercase mt-1">Try adjusting your filters</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Add Button for Mobile */}
        {!isDesktop && (
          <Button
            className="fixed bottom-8 right-8 h-16 w-16 rounded-full shadow-2xl bg-[#FF8882] hover:bg-[#D89D9D] text-white flex items-center justify-center z-50 group"
            onClick={() => setLocation('/ledger/add-customer')}
          >
            <UserPlus className="h-6 w-6" />
          </Button>
        )}

        {/* All Creditors List Popup */}
        <Dialog open={isCredPopupOpen} onOpenChange={setIsCredPopupOpen}>
          <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
            <div className="bg-slate-900 p-8 text-white relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#BF953F]/10 rounded-full -mr-16 -mt-16 blur-2xl" />
              <h2 className="text-2xl font-black tracking-tighter uppercase relative z-10">Creditor Registry</h2>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] relative z-10">All Registered Accounts</p>
            </div>
            
            <div className="p-8 bg-white">
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                {creditors.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-md transition-all group">
                    <div>
                      <div className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{c.name}</div>
                      <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">REF: {c.id.substring(0, 8)}</div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 px-4 rounded-xl border-slate-100 text-[9px] font-black uppercase tracking-widest group-hover:border-[#BF953F]/30"
                      onClick={() => {
                        setLocation(`/admin/creditors/${c.id}`);
                        setIsCredPopupOpen(false);
                      }}
                    >
                      View Details
                    </Button>
                  </div>
                ))}
                {creditors.length === 0 && (
                  <div className="text-center py-10 opacity-40">
                    <p className="text-[10px] font-black uppercase tracking-widest">No accounts found</p>
                  </div>
                )}
              </div>
              <Button onClick={() => setIsCredPopupOpen(false)} className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest mt-6">Close Registry</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Send Reminder Dialog */}
        <Dialog open={isRemindOpen} onOpenChange={setIsRemindOpen}>
          <DialogContent className="max-w-sm rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
            <div className="bg-slate-900 p-8 text-white text-center">
              <div className="w-16 h-16 bg-[#BF953F]/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Bell className="w-8 h-8 text-[#BF953F]" />
              </div>
              <h2 className="text-xl font-black tracking-tighter uppercase">Send Reminder</h2>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Select notification channel</p>
            </div>
            
            <div className="p-8 bg-white grid grid-cols-3 gap-3">
              {[
                { label: 'SMS', icon: Phone, color: 'emerald' },
                { label: 'Chat', icon: MessageCircle, color: 'blue' },
                { label: 'Viber', icon: Smartphone, color: 'purple' }
              ].map((channel) => (
                <Button 
                  key={channel.label}
                  variant="outline" 
                  className="h-24 flex flex-col items-center justify-center gap-2 rounded-2xl border-slate-100 hover:border-[#BF953F]/30 hover:bg-[#BF953F]/5 transition-all group"
                  onClick={() => setIsRemindOpen(false)}
                >
                  <channel.icon className={cn("w-6 h-6 text-slate-400 group-hover:scale-110 transition-transform")} />
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-900">{channel.label}</span>
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
