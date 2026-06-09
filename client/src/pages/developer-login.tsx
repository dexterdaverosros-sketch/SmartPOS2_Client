import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Lock, User, ArrowRight, ShieldAlert, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

const DeveloperLogin: React.FC = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Fixed credentials as requested
    if (username === 'dexter dave ros' && password === '061004Ros') {
      setTimeout(() => {
        localStorage.setItem('is_dev', 'true');
        toast({
          title: "Access Granted",
          description: "Welcome back, Developer. Console initialized.",
        });
        setLocation('/developer-console');
      }, 1500);
    } else {
      setTimeout(() => {
        setIsLoading(false);
        toast({
          title: "Access Denied",
          description: "Invalid developer credentials.",
          variant: "destructive",
        });
      }, 1000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Matrix-like background effect */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#BF953F10_0%,transparent_50%)]"></div>
        <div className="absolute w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
      </div>

      {/* Animated nodes */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#BF953F]/5 rounded-full blur-[150px] animate-pulse"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-[#BF953F]/5 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '2s' }}></div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-12">
          <motion.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl mb-8"
          >
            <Terminal className="w-4 h-4 text-[#BF953F]" />
            <span className="text-[#BF953F] text-[10px] font-black tracking-[0.3em] uppercase">Developer Mode</span>
          </motion.div>
          
          <h1 className="text-4xl font-black text-white mb-3 tracking-tighter">
            WELCOME <span className="gold-gradient-text uppercase">DEVELOPER</span>
          </h1>
          <p className="text-gray-500 text-sm font-medium">
            Monitor and manage SmartPOS+ ecosystem
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#BF953F] to-transparent opacity-50"></div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">Terminal Identifier</label>
              <div className="relative group/input">
                <User className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within/input:text-[#BF953F] transition-colors" />
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  className="h-14 bg-white/5 border-white/10 rounded-2xl pl-14 text-white font-bold placeholder:text-white/10 focus:ring-2 focus:ring-[#BF953F]/20 focus:border-[#BF953F]/50 transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-1">Access Protocol</label>
              <div className="relative group/input">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within/input:text-[#BF953F] transition-colors" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="h-14 bg-white/5 border-white/10 rounded-2xl pl-14 text-white font-bold placeholder:text-white/10 focus:ring-2 focus:ring-[#BF953F]/20 focus:border-[#BF953F]/50 transition-all"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 bg-white text-black hover:bg-white/90 rounded-2xl font-black uppercase tracking-[0.2em] transition-all relative overflow-hidden group/btn mt-4"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 animate-spin" />
                  <span>INITIALIZING...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <span>Authorize Console</span>
                  <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                </div>
              )}
            </Button>
          </form>

          <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Build Version</span>
              <span className="text-[10px] font-bold text-gray-400">2.0.1 (STABLE)</span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Environment</span>
              <span className="text-[10px] font-bold text-emerald-500 uppercase">Production</span>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-center gap-6 opacity-30 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500">
           <ShieldAlert className="w-5 h-5 text-gray-400" />
           <Cpu className="w-5 h-5 text-gray-400" />
           <Lock className="w-5 h-5 text-gray-400" />
        </div>
      </motion.div>
    </div>
  );
};

export default DeveloperLogin;
