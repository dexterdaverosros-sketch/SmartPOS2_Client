import React, { useState, useEffect } from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { databaseSyncService } from '@/lib/sync';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Wifi, CloudUpload, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const NetworkSyncPrompt: React.FC = () => {
  const { isOnline, wasOffline, clearWasOffline } = useNetworkStatus();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowPrompt(true);
    }
  }, [isOnline, wasOffline]);

  const handlePushSync = async () => {
    const tenantId = (user as any)?.tenantId || (user as any)?.tenant_id || localStorage.getItem('smartpos_tenant_id') || 'default-tenant-id';
    setIsSyncing(true);
    try {
      toast({ title: 'Syncing Offline Data...', description: 'Pushing offline transactions to Supabase Cloud' });
      await databaseSyncService.pushAllToCloud(tenantId);
      toast({ title: 'Cloud Sync Complete', description: 'All offline sales, products, and records uploaded successfully!' });
      setShowPrompt(false);
      clearWasOffline();
    } catch (err: any) {
      console.error('Offline push error:', err);
      toast({ title: 'Push Sync Failed', description: err?.message || 'Failed to sync offline data to cloud', variant: 'destructive' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    clearWasOffline();
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl text-slate-100 space-y-5"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Wifi className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Internet Connection Restored!</h3>
                <p className="text-xs text-emerald-400 font-medium">Network re-established</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/60">
              You were running in offline mode. Would you like to push all offline sales, remittances, and store data processed locally to the cloud now?
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleDismiss}
                disabled={isSyncing}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-all disabled:opacity-50"
              >
                Sync Later
              </button>
              <button
                type="button"
                onClick={handlePushSync}
                disabled={isSyncing}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <CloudUpload className="w-4 h-4" />
                    <span>Push Data Now</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
