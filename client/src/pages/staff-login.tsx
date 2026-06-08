import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { User, ArrowLeft, Eye, EyeOff, Lock } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { AuthService } from '@/lib/db';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const staffLoginSchema = z.object({
  staffId: z.string().min(1, 'Staff ID is required'),
  passkey: z.string().min(1, 'Passkey is required'),
  rememberMe: z.boolean().optional().default(false),
});

type StaffLoginFormData = z.infer<typeof staffLoginSchema>;

const StaffLogin: React.FC = () => {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, loginStaff } = useAuth();
  const { toast } = useToast();

  const form = useForm<StaffLoginFormData>({
    resolver: zodResolver(staffLoginSchema),
    defaultValues: {
      staffId: '',
      passkey: '',
      rememberMe: true,
    },
  });
  
  // Load saved credentials on component mount
  useEffect(() => {
    const savedStaffId = localStorage.getItem('staff_id');
    const savedPasskey = localStorage.getItem('staff_passkey');
    const rememberMeState = localStorage.getItem('staff_remember_me') === 'true';
    
    if (savedStaffId && savedPasskey && rememberMeState) {
      form.setValue('staffId', savedStaffId);
      form.setValue('passkey', savedPasskey);
      form.setValue('rememberMe', rememberMeState);
    }
  }, [form]);

  const handleSuccessfulLogin = async (user: any, data: StaffLoginFormData) => {
    // Save or clear credentials based on remember me checkbox
    if (data.rememberMe) {
      localStorage.setItem('staff_id', data.staffId.trim());
      localStorage.setItem('staff_passkey', data.passkey);
      localStorage.setItem('staff_remember_me', 'true');
    } else {
      // Clear saved credentials if remember me is unchecked
      localStorage.removeItem('staff_id');
      localStorage.removeItem('staff_passkey');
      localStorage.removeItem('staff_remember_me');
    }
    
    // Note: login() is handled by loginStaff in AuthContext
    
    toast({
      title: 'Welcome!',
      description: `Logged in as ${user.name || 'Staff Member'}`,
    });
    setLocation('/scanner');
  };

  const onSubmit = async (data: StaffLoginFormData) => {
    setIsLoading(true);
    try {
      await loginStaff(data.staffId.trim(), data.passkey);
      
      // Get user from updated context or just proceed (context updates automatically)
      // We can assume success if no error was thrown
      // We construct a minimal user object for the welcome message if needed, 
      // or rely on the context state in the next render cycle.
      // For the toast, we can just say "Staff Member" or fetch the user name if loginStaff returned it.
      // But loginStaff returns Promise<void>.
      // Let's trust the toast or just use a generic message if we don't have the user object handy here.
      // actually, loginStaff stores it in context.
      
      await handleSuccessfulLogin({ name: 'Staff Member' }, data); 
      
    } catch (error) {
      console.error('Staff login error:', error);
      toast({
        title: 'Login Failed',
        description: error instanceof Error ? error.message : 'Invalid credentials or network error',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-br from-[#BF953F]/10 via-white to-white flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-[400px] bg-white/95 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15)] border border-gray-100 p-8"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-[#FF8882] to-[#D89D9D] rounded-[2rem] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#FF8882]/20">
            <User className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-black tracking-tight uppercase text-gray-900">Staff Login</h2>
          <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-1">Enter your credentials</p>
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="staffId"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">Staff ID</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 group-focus-within:text-[#FF8882] transition-colors" />
                      <Input
                        placeholder="Enter your staff ID"
                        data-testid="input-staff-id"
                        className="h-12 pl-11 bg-gray-50 border-gray-100 rounded-2xl focus:ring-2 focus:ring-[#FF8882]/20 focus:border-[#FF8882] transition-all text-sm font-bold placeholder:text-gray-300"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-[10px] font-bold text-red-500" />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="passkey"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">Passkey</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300">
                        <Lock className="w-4 h-4" />
                      </div>
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        data-testid="input-passkey"
                        className="h-12 pl-11 pr-12 bg-gray-50 border-gray-100 rounded-2xl focus:ring-2 focus:ring-[#FF8882]/20 focus:border-[#FF8882] transition-all text-sm font-bold placeholder:text-gray-300"
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        data-testid="button-toggle-password"
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-[#FF8882] transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage className="text-[10px] font-bold text-red-500" />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="rememberMe"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-remember-me"
                      className="rounded-md border-gray-200 data-[state=checked]:bg-[#FF8882] data-[state=checked]:border-[#FF8882]"
                    />
                  </FormControl>
                  <FormLabel className="text-[9px] font-bold uppercase tracking-widest text-gray-500 cursor-pointer">
                    Remember me
                  </FormLabel>
                </FormItem>
              )}
            />
            
            <Button
              type="submit"
              disabled={isLoading}
              data-testid="button-staff-login"
              className="w-full h-14 bg-gradient-to-r from-[#FF8882] to-[#D89D9D] rounded-2xl font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-[#FF8882]/20 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </Form>
        
        <button
          onClick={() => setLocation('/role-selection')}
          data-testid="button-back"
          className="mt-6 mx-auto text-gray-400 text-[9px] font-black uppercase tracking-[0.2em] flex items-center hover:text-gray-900 transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-2" />
          Back to Portal
        </button>
      </motion.div>
    </motion.div>
  );
};

export default StaffLogin;
