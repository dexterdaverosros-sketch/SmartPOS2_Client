import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Store, ArrowLeft, Lock, X, Unlock, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AuthService } from '@/lib/db';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';

const signupSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  ownerName: z.string().min(1, 'Owner name is required'),
  mobile: z.string().min(10, 'Valid mobile number is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type SignupFormData = z.infer<typeof signupSchema>;

const AdminSignup: React.FC = () => {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showUnbindDialog, setShowUnbindDialog] = useState(false);
  const [unbindUsername, setUnbindUsername] = useState('');
  const [unbindPassword, setUnbindPassword] = useState('');
  const [unbindLoading, setUnbindLoading] = useState(false);
  const [unbindError, setUnbindError] = useState<string | null>(null);
  const { login, unbindDevice } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const hasToken = typeof localStorage !== 'undefined' && !!localStorage.getItem('smartpos_token');
    const hasUser = typeof localStorage !== 'undefined' && !!localStorage.getItem('smartpos_user');
    if (!hasToken && !hasUser) {
      AuthService.purgeLocalState({ skipApiCall: true }).catch(e =>
        console.warn('[admin-signup] Mount purge error (non-fatal):', e)
      );
    }
  }, []);

  const checkStatus = useCallback(async () => {
    try {
      const data = await api.get('/api/auth/status');
      if (data.configured || data.adminExists) {
        setIsLocked(true);
      } else {
        setIsLocked(false);
      }
    } catch (e) {
      console.warn('Failed to check system status');
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleSubmitUnbind = async () => {
    setUnbindError(null);
    setUnbindLoading(true);
    try {
      const r = await unbindDevice({
        adminUsername: unbindUsername.trim() || undefined,
        adminPassword: unbindPassword || undefined,
      });
      if (!r.success) {
        setUnbindError(r.error || 'Unbind failed. Please verify credentials.');
        return;
      }
      toast({ title: 'Device Unbound', description: 'You can now register a new admin on this device.' });
      setShowUnbindDialog(false);
      setUnbindUsername('');
      setUnbindPassword('');
      await checkStatus();
    } catch (e: any) {
      setUnbindError(e?.message || String(e) || 'Unbind failed');
    } finally {
      setUnbindLoading(false);
    }
  };

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      businessName: '',
      ownerName: '',
      mobile: '',
      password: '',
    },
  });

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    try {
      const response = await AuthService.createAdmin(data);
      login(response.user, response.token);
      toast({
        title: 'Account Created',
        description: 'Welcome to SmartPOS+!',
      });
      setLocation('/admin-dashboard');
    } catch (error) {
      console.error('Signup error:', error);
      toast({
        title: 'Signup Failed',
        description: error instanceof Error ? error.message : 'An error occurred while creating your account',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLocked) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <Lock className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Registration Locked</h2>
          <p className="text-gray-600 mb-8 max-w-xs">
            This SmartPOS+ system is already configured for another business. Please login instead.
          </p>
          <div className="w-full max-w-xs space-y-3">
            <Button
              onClick={() => setLocation('/admin-login')}
              className="w-full bg-[#FF8882] hover:bg-[#D89D9D] rounded-xl py-5 font-bold shadow-lg"
            >
              Go to Login
            </Button>
            <Button
              onClick={() => setShowUnbindDialog(true)}
              variant="outline"
              className="w-full rounded-xl py-5 font-semibold border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              <Unlock className="w-4 h-4 mr-2" />
              Unbind This Device
            </Button>
          </div>
        </div>

        {showUnbindDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 relative">
              <button
                onClick={() => { setShowUnbindDialog(false); setUnbindError(null); }}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-700"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Unlock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900">Unbind This Device</h3>
                  <p className="text-xs text-gray-500">Confirm admin credentials to unbind.</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Admin Username</label>
                  <Input
                    value={unbindUsername}
                    onChange={(e) => setUnbindUsername(e.target.value)}
                    placeholder="e.g. admin"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Admin Password</label>
                  <Input
                    type="password"
                    value={unbindPassword}
                    onChange={(e) => setUnbindPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full"
                  />
                </div>
                {unbindError && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">
                    {unbindError}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setShowUnbindDialog(false); setUnbindError(null); }}
                    className="flex-1 rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSubmitUnbind}
                    disabled={unbindLoading}
                    className="flex-1 rounded-xl bg-[#FF8882] hover:bg-[#D89D9D] text-white"
                  >
                    {unbindLoading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Unbinding...</>
                    ) : 'Unbind Device'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-white"
    >
      <div className="p-6">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-6 pt-6"
        >
          <Store className="w-16 h-16 text-primary-500 mb-4 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-800">Setup Your Business</h2>
          <p className="text-gray-600 mt-2">Create a new SmartPOS+ account</p>
        </motion.div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="businessName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 font-medium">Business Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Kanegosyo Store"
                      data-testid="input-business-name"
                      className="p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="ownerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 font-medium">Owner's Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Your full name"
                      data-testid="input-owner-name"
                      className="p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="mobile"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 font-medium">Mobile Number</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="+63 9XX XXX XXXX"
                      data-testid="input-mobile"
                      className="p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 font-medium">Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Create a strong password"
                      data-testid="input-password"
                      className="p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button
              type="submit"
              disabled={isLoading}
              data-testid="button-create-account"
              className="w-full bg-[#FF8882] text-white p-4 rounded-xl font-semibold shadow-lg hover:bg-[#D89D9D] mt-6 touch-feedback"
              style={{
                boxShadow: '0 4px 12px rgba(255, 136, 130, 0.3)',
              }}
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>
        </Form>
        
        <div className="text-center mt-4">
          <span className="text-gray-500">Already have an account?</span>
          <button
            onClick={() => setLocation('/admin-login')}
            data-testid="button-go-login"
            className="text-primary-500 font-semibold ml-1"
          >
            Login
          </button>
        </div>
        
        <button
          onClick={() => setLocation('/role-selection')}
          data-testid="button-back"
          className="mt-4 text-gray-400 flex items-center touch-feedback"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>
      </div>
    </motion.div>
  );
};

export default AdminSignup;
