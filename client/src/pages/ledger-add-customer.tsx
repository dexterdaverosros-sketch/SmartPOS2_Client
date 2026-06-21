import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CreditorService } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import Layout from '@/components/Layout';

export default function AddCreditorPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      await CreditorService.addCreditor({
        name: name.trim(),
        phone: phone.trim() || null,
        amount: Number(amount) || 0,
        dueDate: dueDate ? new Date(dueDate) : null,
        isPaid: false,
        description: notes.trim() || null,
        createdAt: new Date(),
      });
      toast({ title: 'Success', description: 'Creditor added successfully' });
      setLocation('/ledger');
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add creditor', variant: 'destructive' });
      console.error('Add creditor error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout showNavigation={false}>
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-md mx-auto">
          <Button
            variant="ghost"
            onClick={() => setLocation('/ledger')}
            className="mb-6"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </Button>

          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center">
                <User className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight">Add Creditor</h1>
                <p className="text-slate-500 text-sm">Register a new credit account</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label htmlFor="name" className="text-sm font-bold text-slate-700">Full Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter creditor name"
                  className="h-12 rounded-xl mt-2"
                  autoFocus
                />
              </div>

              <div>
                <Label htmlFor="phone" className="text-sm font-bold text-slate-700">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Enter phone number"
                  className="h-12 rounded-xl mt-2"
                />
              </div>

              <div>
                <Label htmlFor="amount" className="text-sm font-bold text-slate-700">Initial Amount (₱)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-12 rounded-xl mt-2"
                />
              </div>

              <div>
                <Label htmlFor="dueDate" className="text-sm font-bold text-slate-700">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-12 rounded-xl mt-2"
                />
              </div>

              <div>
                <Label htmlFor="notes" className="text-sm font-bold text-slate-700">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes about this creditor"
                  rows={4}
                  className="rounded-xl mt-2"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
              >
                {isLoading ? 'Adding...' : 'Add Creditor'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
}
