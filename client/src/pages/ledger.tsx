import React, { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { useLocation } from "wouter";
import { ArrowLeft, User as UserIcon, Users, Search, Filter, Calendar, Bell, ChevronRight, MessageCircle, Smartphone, Phone } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CreditorService } from "@/lib/db";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
 

export default function LedgerPage() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [sortAZ, setSortAZ] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [creditors, setCreditors] = useState<Array<{ id: string; name: string; amount: number; isPaid: boolean }>>([]);
  

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
  const totalCreditors = creditors.length;
  const totalPayments = useMemo(() => creditors.filter(c => c.isPaid).reduce((s, c) => s + c.amount, 0), [creditors]);

  const formatCurrency = (v: number) => {
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' }).format(v); }
    catch { return `₱${v.toFixed(2)}`; }
  };
  const [isCredPopupOpen, setIsCredPopupOpen] = useState(false);
  const [remindCreditorId, setRemindCreditorId] = useState<string | null>(null);
  const [isRemindOpen, setIsRemindOpen] = useState(false);

  return (
    <Layout>
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
          <div className="bg-white dark:bg-gray-800 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <button
                  onClick={() => setLocation('/admin-main')}
                  className="mr-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200">Ledger</h1>
              </div>
              <button
                onClick={() => setIsCredPopupOpen(true)}
                className="px-3 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 flex items-center gap-2 text-sm"
              >
                <Users className="w-4 h-4" />
                <span>Creditors</span>
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <Search className="w-4 h-4 text-gray-600" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search creditors"
                  className="bg-transparent outline-none text-sm"
                />
              </div>
              <button
                className="ml-auto px-3 py-2 rounded-xl border border-purple-600 text-purple-700 bg-white hover:bg-purple-50 flex items-center gap-2"
                onClick={() => setSortAZ(v => !v)}
              >
                <Filter className="w-4 h-4" />
                <span>A-z</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 flex flex-col items-center justify-center">
                <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(totalBalance)}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Balance</div>
              </div>
              <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
                <div className="text-sm text-gray-700 dark:text-gray-300">Total Creditors</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalCreditors}</div>
                <div className="mt-4 text-sm text-gray-700 dark:text-gray-300">Total Payment</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(totalPayments)}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex gap-2">
                <Button variant={statusFilter==='all'?'default':'outline'} onClick={() => setStatusFilter('all')}>All</Button>
                <Button variant={statusFilter==='unpaid'?'default':'outline'} onClick={() => setStatusFilter('unpaid')}>Unpaid</Button>
                <Button variant={statusFilter==='paid'?'default':'outline'} onClick={() => setStatusFilter('paid')}>Paid</Button>
              </div>
              <button className="ml-auto px-3 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Due Date</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
              <div>Reminder</div>
              <div>Creditors Name</div>
              <div>Debt</div>
            </div>

            {filtered.length > 0 ? (
              <div className="space-y-2">
                {filtered.map(c => (
                  <div key={c.id} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                    <div className="flex items-center gap-3">
                      <button className="px-3 py-1 rounded-lg border border-gray-300 hover:bg-gray-50 flex items-center gap-2" onClick={() => { setRemindCreditorId(c.id); setIsRemindOpen(true); }}>
                        <Bell className="w-4 h-4" />
                        <span>Remind</span>
                      </button>
                      <div className="text-gray-800 dark:text-gray-200 font-medium cursor-pointer hover:underline" onClick={() => setLocation(`/admin/creditors/${c.id}`)}>
                        {c.name}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-gray-900 dark:text-gray-100 font-semibold cursor-pointer hover:text-purple-600" onClick={() => setLocation(`/admin/creditors/${c.id}`)}>
                        {formatCurrency(c.amount)}
                      </div>
                      <button
                        className="px-2 py-1 rounded-lg border border-gray-300 hover:bg-gray-50 flex items-center"
                        onClick={() => setLocation(`/admin/creditors/${c.id}`)}
                      >
                        <motion.div whileTap={{ scale: 0.95 }} transition={{ duration: 0.1 }}>
                          <ChevronRight className="w-5 h-5 text-gray-500" />
                        </motion.div>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-600 dark:text-gray-400">No creditors</div>
            )}
          </div>

          <button
            onClick={async () => {
              try {
                console.log('Navigating to register creditors');
                setLocation('/ledger/add-customer');
                console.log('Navigation to add-customer initiated');
              } catch (e) {
                console.error('Failed to navigate to add-customer', e);
              }
            }}
            className="fixed bottom-28 right-6 z-50 px-5 h-12 bg-[#FF8882] text-white rounded-full shadow-lg hover:bg-[#D89D9D] transition-colors flex items-center gap-2"
            style={{ boxShadow: '0 4px 12px rgba(255, 136, 130, 0.3)' }}
          >
            <motion.div whileTap={{ scale: 0.95 }} transition={{ duration: 0.1 }}>
              <UserIcon className="w-5 h-5" />
            </motion.div>
            <span>Register Creditors</span>
          </button>

          <Dialog open={isCredPopupOpen} onOpenChange={setIsCredPopupOpen}>
            <DialogContent className="sm:max-w-md dark:bg-gray-800 dark:text-gray-200">
              <DialogHeader>
                <DialogTitle>Creditors</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                {creditors.map(c => (
                  <div key={c.id} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                    <div className="flex items-center gap-3">
                      
                      <div>
                        <div className="text-gray-900 dark:text-gray-100 font-semibold">{c.name}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">ID: {c.id}</div>
                      </div>
                    </div>
                    <button
                      className="px-3 py-1 rounded-lg border border-gray-300 hover:bg-gray-50 flex items-center gap-2"
                      onClick={async () => {
                        try {
                          console.log(`Navigating to creditor details for ID: ${c.id}`);
                          setLocation(`/admin/creditors/${c.id}`);
                          console.log('Navigation to creditor details initiated');
                        } catch (e) {
                          console.error(`Failed to navigate to creditor details for ID: ${c.id}`, e);
                        }
                      }}
                    >
                      <motion.div whileTap={{ scale: 0.95 }} transition={{ duration: 0.1 }}>
                        <ChevronRight className="w-4 h-4" />
                      </motion.div>
                      <span>Open</span>
                    </button>
                  </div>
                ))}
                {creditors.length === 0 && (
                  <div className="text-sm text-gray-600 dark:text-gray-400 p-2">No creditors</div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isRemindOpen} onOpenChange={setIsRemindOpen}>
            <DialogContent className="sm:max-w-sm dark:bg-gray-800 dark:text-gray-200">
              <DialogHeader>
                <DialogTitle>Send Reminder</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-3">
                <Button variant="outline" className="flex flex-col items-center gap-2" onClick={() => setIsRemindOpen(false)}>
                  <Phone className="w-5 h-5" />
                  SMS
                </Button>
                <Button variant="outline" className="flex flex-col items-center gap-2" onClick={() => setIsRemindOpen(false)}>
                  <MessageCircle className="w-5 h-5" />
                  Messenger
                </Button>
                <Button variant="outline" className="flex flex-col items-center gap-2" onClick={() => setIsRemindOpen(false)}>
                  <Smartphone className="w-5 h-5" />
                  Viber
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
    </Layout>
  );
}
