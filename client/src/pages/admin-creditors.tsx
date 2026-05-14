import React, { useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CreditorService } from '@/lib/db';
import { useLocation, useRoute } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AdminCreditors() {
  const [, setLocation] = useLocation();
  const [rows, setRows] = useState<Array<{ id: string; name: string; amount: number; isPaid: boolean; description?: string }>>([]);
  const [match, params] = useRoute('/admin/creditors/:id');
  const selectedId = match ? params?.id : undefined;
  const selected = useMemo(() => rows.find(r => r.id === selectedId), [rows, selectedId]);
  const [creditTransactions, setCreditTransactions] = useState<Array<{ date: string; total: number; items: Array<{ name: string; quantity: number; unit: string; subtotal: number }> }>>([]);
  const [paymentHistory, setPaymentHistory] = useState<Array<{ date: string; amount: number; method: string }>>([]);
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [payValue, setPayValue] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const data = await CreditorService.getAllCreditors();
      setRows(data.map(c => ({ id: c.id, name: c.name, amount: c.amount || 0, isPaid: !!c.isPaid, description: (c as any).description })));
      const sel = data.find(c => c.id === selectedId);
      const desc = (sel as any)?.description;
      try {
        const parsed = desc ? JSON.parse(desc) : [];
        if (Array.isArray(parsed)) {
          setCreditTransactions(parsed);
          setPaymentHistory([]);
        } else if (parsed && typeof parsed === 'object') {
          const credits = Array.isArray(parsed.credits) ? parsed.credits : [];
          const pays = Array.isArray(parsed.payments) ? parsed.payments : [];
          setCreditTransactions(credits);
          setPaymentHistory(pays);
        } else {
          setCreditTransactions([]);
          setPaymentHistory([]);
        }
      } catch { setCreditTransactions([]); setPaymentHistory([]); }
    })();
  }, []);

  const formatCurrency = (v: number) => {
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' }).format(v); }
    catch { return `₱${v.toFixed(2)}`; }
  };

  if (selectedId && selected) {
    return (
      <Layout>
        <div className="p-4 space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setLocation('/admin/creditors')} className="px-3 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 flex items-center gap-2 text-sm">
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <div className="text-lg font-semibold">Creditor Details</div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="text-xl font-bold text-gray-900">{selected.name}</div>
                <div className="text-sm text-gray-600">ID: {selected.id}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-700">Amount</div>
                <div className="text-lg font-semibold">{formatCurrency(selected.amount)}</div>
                <div className="mt-1 text-xs">{selected.isPaid ? 'Paid' : 'Unpaid'}</div>
                <div className="mt-2 flex gap-2 justify-end">
                  <Button onClick={() => { setPayValue(String(selected.amount)); setIsPayOpen(true); }} className="bg-[#FF8882] hover:bg-[#D89D9D] text-white">Pay</Button>
                  <Button onClick={() => setIsHistoryOpen(true)} className="bg-[#FF8882] hover:bg-[#D89D9D] text-white">History of paying Credits</Button>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-lg font-semibold mb-2">Credited Purchases</div>
            {creditTransactions.length === 0 ? (
              <div className="text-sm text-gray-600">No credited purchases recorded.</div>
            ) : (
              <div className="space-y-3">
                {creditTransactions.map((t, idx) => (
                  <div key={idx} className="border rounded-lg p-3 bg-white">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>{new Date(t.date).toLocaleString()}</span>
                      <span className="font-medium">{formatCurrency(t.total)}</span>
                    </div>
                    <div className="space-y-1">
                      {t.items.map((it, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-gray-800">{it.name}</span>
                          <span className="text-gray-600">{it.quantity} {it.unit}</span>
                          <span className="text-gray-900">₱{it.subtotal.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Credit Balance: {formatCurrency(selected.amount)}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <div className="text-sm">Amount Paid</div>
                <Input type="number" value={payValue} onChange={(e) => setPayValue(e.target.value)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsPayOpen(false)}>Cancel</Button>
                <Button onClick={async () => {
                  const amt = parseFloat(payValue || '0');
                  const due = Math.round((selected.amount || 0) * 100) / 100;
                  const p = Math.round(amt * 100) / 100;
                  
                  try {
                    await CreditorService.recordPayment(selected.id, p, 'cash');
                    toast({ title: 'Paid', description: 'Credits settled and recorded as income' });
                    const data = await CreditorService.getAllCreditors();
                    setRows(data.map(c => ({ id: c.id, name: c.name, amount: c.amount || 0, isPaid: !!c.isPaid, description: (c as any).description })));
                    setIsPayOpen(false);
                  } catch (e: any) {
                    toast({ title: 'Error', description: e?.message || 'Failed to record payment', variant: 'destructive' });
                  }
                }}>Confirm</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>History of paying Credits</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-semibold mb-2">Payments</div>
                  {paymentHistory.length === 0 ? (
                    <div className="text-sm text-gray-600">No payments recorded.</div>
                  ) : (
                    <div className="space-y-2">
                      {paymentHistory.map((p, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span>{new Date(p.date).toLocaleString()}</span>
                          <span>{formatCurrency(p.amount)}</span>
                          <span>{p.method}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold mb-2">Credited Purchases</div>
                  {creditTransactions.length === 0 ? (
                    <div className="text-sm text-gray-600">No credited purchases recorded.</div>
                  ) : (
                    <div className="space-y-3">
                      {creditTransactions.map((t, idx) => (
                        <div key={idx} className="border rounded-lg p-3 bg-white">
                          <div className="flex justify-between text-sm text-gray-600 mb-2">
                            <span>{new Date(t.date).toLocaleString()}</span>
                            <span className="font-medium">{formatCurrency(t.total)}</span>
                          </div>
                          <div className="space-y-1">
                            {t.items.map((it, i) => (
                              <div key={i} className="flex justify-between text-sm">
                                <span className="text-gray-800">{it.name}</span>
                                <span className="text-gray-600">{it.quantity} {it.unit}</span>
                                <span className="text-gray-900">₱{it.subtotal.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 space-y-4">
        <Card className="p-4">
          <div className="text-lg font-semibold">Creditor List</div>
          <div className="text-sm text-gray-600">Registered creditors in the system</div>
        </Card>

        <div className="flex justify-start">
          <button 
            onClick={() => setLocation('/admin-main')} 
            className="px-3 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 flex items-center gap-2 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        </div>

        <Card className="p-0 overflow-hidden">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-700">
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Amount</th>
                <th className="px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t bg-white">
                  <td className="px-3 py-2 text-gray-800">{r.name}</td>
                  <td className="px-3 py-2 text-gray-900 font-medium">{formatCurrency(r.amount)}</td>
                  <td className="px-3 py-2">{r.isPaid ? 'Paid' : 'Unpaid'}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-gray-500" colSpan={3}>No creditors</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </Layout>
  );
}
