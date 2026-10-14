import React, { useState, useEffect, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppErrorBoundary } from './components/common/AppErrorBoundary';
import { DeliveryProvider, useDelivery } from './context/DeliveryContext';
import { LayoutGrid, X } from 'lucide-react';

const CustomerPortal = lazy(() => import('./components/customer/CustomerPortal').then(m => ({ default: m.CustomerPortal })));

function CustomerSiteLayout() {
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const { 
    currentUser,
    isSupabaseConfigured, 
    supabaseConfig, 
    connectSupabase 
  } = useDelivery();

  const [dbUrl, setDbUrl] = useState(supabaseConfig.url || '');
  const [dbKey, setDbKey] = useState(supabaseConfig.anonKey || '');
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const handleOpenDb = () => setIsDbModalOpen(true);
    window.addEventListener('open-db-modal', handleOpenDb);
    return () => window.removeEventListener('open-db-modal', handleOpenDb);
  }, []);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setIsConnecting(true);
    const res = await connectSupabase(dbUrl, dbKey);
    setIsConnecting(false);
    if (res.success) {
      alert('✅ Connected to Supabase!');
      setIsDbModalOpen(false);
    } else {
      alert('❌ ' + res.message);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans relative">
      {/* Database Connection Modal */}
          <AnimatePresence>
            {isDbModalOpen && (
              <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsDbModalOpen(false)}
                  className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                />
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 20 }}
                  className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
                >
                  <div className="p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                          <LayoutGrid className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-slate-900 tracking-tight">Supabase Connection</h3>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Connect your own database</p>
                        </div>
                      </div>
                      <button onClick={() => setIsDbModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleConnect} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Supabase Project URL</label>
                        <input 
                          type="url"
                          required
                          value={dbUrl}
                          onChange={(e) => setDbUrl(e.target.value)}
                          placeholder="https://your-project.supabase.co"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Public Anon Key</label>
                        <textarea 
                          required
                          value={dbKey}
                          onChange={(e) => setDbKey(e.target.value)}
                          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all min-h-[100px] resize-none"
                        />
                      </div>

                      <div className="bg-amber-50 border border-amber-100 p-3 rounded-2xl">
                        <p className="text-[11px] text-amber-700 font-bold leading-relaxed">
                          ⚠️ You can find these in your Supabase Project Settings under <b>API</b>.
                          This will allow persistent data storage for Vendors, Riders, and Orders.
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={isConnecting}
                        className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg ${
                          isConnecting 
                            ? 'bg-slate-100 text-slate-400' 
                            : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-500/20'
                        }`}
                      >
                        {isConnecting ? 'Testing Connection...' : 'Connect & Sync Database'}
                      </button>
                    </form>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

      <main className="flex-1">
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="w-10 h-10 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        }>
          <CustomerPortal />
        </Suspense>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <DeliveryProvider>
        <CustomerSiteLayout />
      </DeliveryProvider>
    </AppErrorBoundary>
  );
}
