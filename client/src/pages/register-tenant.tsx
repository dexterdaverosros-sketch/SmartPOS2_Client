import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Building2, Globe, User, Lock, Eye, EyeOff, Sparkles, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, Store } from 'lucide-react';
import { motion } from 'framer-motion';

const RegisterTenant: React.FC = () => {
  const [formData, setFormData] = useState({
    storeName: '',
    subdomain: '',
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; tenantUrl?: string } | null>(null);
  const [, setLocation] = useLocation();

  const handleStoreNameChange = (val: string) => {
    const slug = val.toLowerCase().replace(/[^a-z0-9]/g, '');
    setFormData(prev => ({
      ...prev,
      storeName: val,
      subdomain: slug
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const originalTenantId = localStorage.getItem('smartpos_tenant');
      localStorage.setItem('smartpos_tenant', formData.subdomain);

      const response = await fetch('/api/tenants/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': formData.subdomain
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          message: 'Store registered successfully! Setting up workspace...',
          tenantUrl: '/admin-login'
        });

        setTimeout(() => {
          setLocation('/admin-login', { replace: true });
        }, 2000);
      } else {
        setResult({
          success: false,
          message: data.message || data.error || 'Registration failed. Please try again.'
        });

        if (originalTenantId) {
          localStorage.setItem('smartpos_tenant', originalTenantId);
        } else {
          localStorage.removeItem('smartpos_tenant');
        }
      }
    } catch (error) {
      console.error('Registration error:', error);
      setResult({
        success: false,
        message: 'An unexpected network error occurred during registration.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Ambient background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Top Navbar Header */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Store className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-lg text-white tracking-wide">SmartPOS<span className="text-blue-400">Pro</span></span>
            <span className="block text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Enterprise Retail OS</span>
          </div>
        </div>
        <button
          onClick={() => setLocation('/admin-login')}
          className="text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 px-4 py-2 rounded-xl transition-all"
        >
          Sign In to Existing Store
        </button>
      </header>

      {/* Main Registration Card Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 z-10 w-full max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center w-full">
          
          {/* Left Brand Column */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-5 space-y-6 text-left hidden lg:block"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Multi-Device Cloud Architecture</span>
            </div>
            
            <h1 className="text-4xl font-extrabold text-white leading-tight tracking-tight">
              Create & Scale Your Retail Store Business
            </h1>
            
            <p className="text-slate-400 text-sm leading-relaxed">
              Power your Point-of-Sale terminal with isolated tenant security, cross-device staff remittance, and real-time Supabase cloud synchronization.
            </p>

            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">1-Device Security Lock</h4>
                  <p className="text-xs text-slate-400">Protects your local database from cross-tenant data leakage.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Cross-Device Staff Terminal</h4>
                  <p className="text-xs text-slate-400">Staff members can log in on any phone or tablet to process sales.</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Form Column */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-7 w-full"
          >
            <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 p-8 sm:p-10 rounded-3xl shadow-2xl shadow-slate-950/80 relative">
              <div className="mb-6 text-center lg:text-left">
                <h2 className="text-2xl font-bold text-white tracking-tight">Register Store Tenant</h2>
                <p className="text-xs text-slate-400 mt-1">Fill in your business details to generate your isolated tenant database</p>
              </div>

              {result && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 mb-6 rounded-2xl border text-xs flex items-start gap-3 ${
                    result.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {result.success ? (
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
                  )}
                  <div className="leading-relaxed font-medium">
                    {result.message}
                  </div>
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Store Name Input */}
                <div className="space-y-1.5">
                  <label htmlFor="storeName" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Store / Business Name
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="storeName"
                      name="storeName"
                      type="text"
                      autoComplete="organization"
                      required
                      value={formData.storeName}
                      onChange={(e) => handleStoreNameChange(e.target.value)}
                      placeholder="e.g. Masing Bakery"
                      className="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                    />
                  </div>
                </div>

                {/* Subdomain Input */}
                <div className="space-y-1.5">
                  <label htmlFor="subdomain" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Store Subdomain Slug
                  </label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="subdomain"
                      name="subdomain"
                      type="text"
                      autoComplete="off"
                      required
                      value={formData.subdomain}
                      onChange={(e) => setFormData({ ...formData, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                      placeholder="e.g. masingbakery"
                      className="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-24 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-mono"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500 bg-slate-900 border border-slate-800 px-2 py-1 rounded-md">
                      .smartpos
                    </span>
                  </div>
                </div>

                {/* Admin Username Input */}
                <div className="space-y-1.5">
                  <label htmlFor="username" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Admin Username
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      required
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value.trim() })}
                      placeholder="e.g. admin"
                      className="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-1.5">
                  <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Enter a secure password"
                      className="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 focus:outline-none transition-colors"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2 group mt-2"
                >
                  {loading ? (
                    <span>Registering Store...</span>
                  ) : (
                    <>
                      <span>Register Store Workspace</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </motion.div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-4 text-center text-xs text-slate-500 z-10 border-t border-slate-900">
        &copy; {new Date().getFullYear()} SmartPOS Enterprise. Isolated Tenant Multi-Store Operating System.
      </footer>
    </div>
  );
};

export default RegisterTenant;
