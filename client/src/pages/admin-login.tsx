import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Shield, ArrowLeft, Eye, EyeOff, Lock, User } from 'lucide-react';
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
import { cn } from '@/lib/utils';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false),
});

type LoginFormData = z.infer<typeof loginSchema>;

const AdminLogin: React.FC = () => {
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
      rememberMe: false,
    },
  });
  
  useEffect(() => {
    const savedUsername = localStorage.getItem('admin_username');
    const savedPassword = localStorage.getItem('admin_password');
    const rememberMeState = localStorage.getItem('admin_remember_me') === 'true';
    
    if (savedUsername && savedPassword && rememberMeState) {
      form.setValue('username', savedUsername);
      form.setValue('password', savedPassword);
      form.setValue('rememberMe', rememberMeState);
    }
  }, [form]);

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const user = await AuthService.loginAdmin(data.username.trim(), data.password);
      if (user) {
        if (data.rememberMe) {
          localStorage.setItem('admin_username', data.username.trim());
          localStorage.setItem('admin_password', data.password);
          localStorage.setItem('admin_remember_me', 'true');
        } else {
          localStorage.removeItem('admin_username');
          localStorage.removeItem('admin_password');
          localStorage.removeItem('admin_remember_me');
        }
        
        login(user);
        toast({
          title: 'Welcome back!',
          description: `Logged in as ${user.businessName || 'Admin'}`,
        });
        setLocation('/admin-dashboard');
      } else {
        toast({
          title: 'Login Failed',
          description: 'Invalid username or password',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred during login',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center overflow-hidden bg-slate-900">
      {/* High-Quality Background Image */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: 'url("https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2069&auto=format&fit=crop")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'brightness(0.3) saturate(1.2) contrast(1.1)',
        }}
      />
      
      {/* Dynamic Overlay Layers */}
      <div className="absolute inset-0 z-[1] bg-slate-950/40" />
      <div className="absolute inset-0 z-[2] bg-gradient-to-b from-transparent via-slate-950/20 to-slate-950/60" />
      <div className="absolute inset-0 z-[3] backdrop-blur-[3px]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[380px] bg-white/95 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15)] border border-white/30 flex flex-col"
      >
        {/* Form Header */}
        <div className="bg-slate-900 p-6 text-center text-white relative flex-none rounded-t-[2.5rem]">
          <div className="absolute inset-0 bg-gradient-to-br from-[#BF953F]/20 to-transparent opacity-50" />
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#BF953F]/10 rounded-full -mr-12 -mt-12 blur-2xl" />
          
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="w-14 h-14 bg-gradient-to-br from-[#BF953F] to-[#B38728] rounded-[1.75rem] flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-[#BF953F]/30"
          >
            <Shield className="w-7 h-7 text-white drop-shadow-md" />
          </motion.div>
          
          <h2 className="text-xl font-black tracking-tight uppercase mb-1.5 bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">Welcome Admin</h2>
          <div className="flex items-center justify-center gap-2">
            <div className="h-px w-3 bg-[#BF953F]" />
            <p className="text-[#BF953F] text-[8px] font-black uppercase tracking-[0.3em]">Secure Access Point</p>
            <div className="h-px w-3 bg-[#BF953F]" />
          </div>
        </div>

        <div className="p-6 pt-5">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">Username</FormLabel>
                    <FormControl>
                      <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-[#BF953F] transition-colors">
                          <User className="w-4 h-4" />
                        </div>
                        <Input
                          placeholder="Enter username"
                          className="h-11 pl-11 bg-gray-50 border-gray-100 rounded-2xl focus:ring-2 focus:ring-[#BF953F]/20 focus:border-[#BF953F] transition-all text-sm font-bold placeholder:text-gray-300"
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
                name="password"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">Password</FormLabel>
                    <FormControl>
                      <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-[#BF953F] transition-colors">
                          <Lock className="w-4 h-4" />
                        </div>
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          className="h-11 pl-11 pr-12 bg-gray-50 border-gray-100 rounded-2xl focus:ring-2 focus:ring-[#BF953F]/20 focus:border-[#BF953F] transition-all text-sm font-bold placeholder:text-gray-300"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-[#BF953F] transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage className="text-[10px] font-bold text-red-500" />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-between items-center px-1">
                <FormField
                  control={form.control}
                  name="rememberMe"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="rounded-md border-gray-200 data-[state=checked]:bg-[#BF953F] data-[state=checked]:border-[#BF953F]"
                        />
                      </FormControl>
                      <FormLabel className="text-[9px] font-black uppercase tracking-widest text-gray-500 cursor-pointer">
                        Stay Logged In
                      </FormLabel>
                    </FormItem>
                  )}
                />
                <button
                  type="button"
                  onClick={() => setLocation('/forgot-password')}
                  className="text-[#BF953F] text-[9px] font-black uppercase tracking-widest hover:text-[#B38728] transition-colors"
                >
                  Reset Link?
                </button>
              </div>
              
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-900/20 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#BF953F] to-[#B38728] opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : 'Login'}
                </span>
              </Button>
            </form>
          </Form>
          
          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <button
              onClick={() => setLocation('/role-selection')}
              className="text-gray-400 text-[9px] font-black uppercase tracking-[0.2em] flex items-center hover:text-gray-900 transition-all mx-auto"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-2" />
              Back to Portal
            </button>
          </div>
        </div>
      </motion.div>

      {/* Footer Info */}
      <div className="absolute bottom-6 left-0 right-0 text-center z-10">
        <div className="flex items-center justify-center gap-3">
          <div className="h-px w-6 bg-white/20" />
          <p className="text-[7px] font-black uppercase tracking-[0.4em] text-white/40">
            SmartPOS+ v4.0 • Enterprise Edition • Secure Encryption Active
          </p>
          <div className="h-px w-6 bg-white/20" />
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
