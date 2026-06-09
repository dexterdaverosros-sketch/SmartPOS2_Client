import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ShieldCheck, UserCircle2, ArrowRight, Monitor, Tablet, Smartphone, ChevronLeft } from 'lucide-react';
import { useDevices, DeviceMode } from '@/contexts/DeviceContext';

const RoleSelection: React.FC = () => {
  const [, setLocation] = useLocation();
  const { deviceMode, setDeviceMode } = useDevices();
  const [step, setStep] = useState<'device' | 'role'>(deviceMode ? 'role' : 'device');
  const [clickCount, setClickCount] = useState(0);

  const handleDevClick = () => {
    const nextCount = clickCount + 1;
    if (nextCount >= 5) {
      setLocation('/developer-login');
    } else {
      setClickCount(nextCount);
      // Reset after 3 seconds of inactivity
      setTimeout(() => setClickCount(0), 3000);
    }
  };

  const handleDeviceSelect = (mode: DeviceMode) => {
    setDeviceMode(mode);
    setStep('role');
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    },
    exit: { opacity: 0, x: -20 }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#BF953F]/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#BF953F]/5 rounded-full blur-[120px]"></div>
      </div>

      <div className="w-full max-w-5xl relative z-10">
        <AnimatePresence mode="wait">
          {step === 'device' ? (
            <motion.div
              key="device-selection"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full"
            >
              <div className="text-center mb-16">
                <motion.div
                  variants={itemVariants}
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-gray-100 shadow-sm mb-8"
                >
                  <div className="w-2 h-2 rounded-full bg-[#BF953F] animate-pulse"></div>
                  <span className="text-gray-400 text-[10px] font-black tracking-[0.2em] uppercase">Initial Setup</span>
                </motion.div>

                <h1 className="text-5xl md:text-7xl font-black mb-4 tracking-tighter leading-none text-gray-900">
                  Select your <span className="gold-gradient-text uppercase">Device</span>
                </h1>
                <p className="text-gray-400 text-lg font-medium max-w-md mx-auto">
                  We'll optimize the interface for your specific hardware.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { id: 'pc', label: 'PC / Laptop', icon: Monitor, desc: 'Optimized for mouse & keyboard. Supports external scanners.' },
                  { id: 'tablet', label: 'Tablet', icon: Tablet, desc: 'Touch-friendly interface with expanded screen real estate.' },
                  { id: 'mobile', label: 'Mobile Phones', icon: Smartphone, desc: 'Native-like mobile experience. Compact & rapid access.' }
                ].map((device) => (
                  <motion.button
                    key={device.id}
                    variants={itemVariants}
                    onClick={() => handleDeviceSelect(device.id as DeviceMode)}
                    className="group relative flex flex-col items-center text-center p-8 rounded-[2.5rem] bg-white border border-gray-100 hover:border-[#BF953F]/30 shadow-[0_10px_40px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_50px_rgba(191,149,63,0.08)] transition-all duration-500"
                  >
                    <div className="w-20 h-20 rounded-3xl bg-amber-50 flex items-center justify-center mb-6 group-hover:bg-[#BF953F] transition-colors duration-500">
                      <device.icon className="w-10 h-10 text-[#BF953F] group-hover:text-white" />
                    </div>
                    <h3 className="text-xl font-black mb-2 text-gray-900 group-hover:text-[#BF953F] transition-colors">
                      {device.label}
                    </h3>
                    <p className="text-gray-400 text-xs font-medium leading-relaxed group-hover:text-gray-500 transition-colors">
                      {device.desc}
                    </p>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="role-selection"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full"
            >
              <div className="text-center mb-16 relative">
                <button 
                  onClick={() => setStep('device')}
                  className="absolute left-0 top-0 flex items-center gap-2 text-gray-400 hover:text-[#BF953F] transition-colors text-xs font-bold uppercase tracking-widest"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Change Device
                </button>

                <motion.div
                  variants={itemVariants}
                  onClick={handleDevClick}
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-gray-100 shadow-sm mb-8 cursor-pointer select-none"
                >
                  <div className="w-2 h-2 rounded-full bg-[#BF953F] animate-pulse"></div>
                  <span className="text-gray-400 text-[10px] font-black tracking-[0.2em] uppercase">Select Access Mode</span>
                </motion.div>

                <h1 className="text-5xl md:text-7xl font-black mb-4 tracking-tighter leading-none">
                  <span className="text-gray-900">Welcome to</span><br />
                  <span className="gold-gradient-text uppercase">SmartPOS+</span>
                </h1>
                <p className="text-gray-400 text-lg font-medium max-w-md mx-auto">
                  Experience the next generation of enterprise management.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <motion.button
                  variants={itemVariants}
                  onClick={() => setLocation('/admin-login')}
                  className="group relative flex flex-col items-start p-10 rounded-[2.5rem] bg-white border border-gray-100 hover:border-[#BF953F]/30 shadow-[0_10px_40px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_50px_rgba(191,149,63,0.08)] transition-all duration-500 overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="w-6 h-6 text-[#BF953F]" />
                  </div>
                  <div className="w-16 h-16 rounded-3xl bg-amber-50 flex items-center justify-center mb-8 group-hover:bg-[#BF953F] transition-colors duration-500">
                    <ShieldCheck className="w-8 h-8 text-[#BF953F] group-hover:text-white" />
                  </div>
                  <h3 className="text-2xl font-black mb-2 text-gray-900 group-hover:text-[#BF953F] transition-colors">Administrator</h3>
                  <p className="text-gray-400 text-sm font-medium leading-relaxed text-left group-hover:text-gray-500 transition-colors">
                    Full system control, strategic oversight, and advanced analytics.
                  </p>
                  <div className="mt-10 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-[#BF953F]/60">
                    <span>Secure Access</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-[#BF953F]/30"></div>
                    <span>Command Center</span>
                  </div>
                </motion.button>

                <motion.button
                  variants={itemVariants}
                  onClick={() => setLocation('/staff-login')}
                  className="group relative flex flex-col items-start p-10 rounded-[2.5rem] bg-white border border-gray-100 hover:border-[#BF953F]/30 shadow-[0_10px_40px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_50px_rgba(191,149,63,0.08)] transition-all duration-500 overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="w-6 h-6 text-[#BF953F]" />
                  </div>
                  <div className="w-16 h-16 rounded-3xl bg-blue-50 flex items-center justify-center mb-8 group-hover:bg-[#BF953F] transition-colors duration-500">
                    <UserCircle2 className="w-8 h-8 text-[#BF953F] group-hover:text-white" />
                  </div>
                  <h3 className="text-2xl font-black mb-2 text-gray-900 group-hover:text-[#BF953F] transition-colors">Staff Member</h3>
                  <p className="text-gray-400 text-sm font-medium leading-relaxed text-left group-hover:text-gray-500 transition-colors">
                    Operational efficiency, customer service, and transaction processing.
                  </p>
                  <div className="mt-10 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-[#BF953F]/60">
                    <span>Rapid Entry</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-[#BF953F]/30"></div>
                    <span>Terminal Mode</span>
                  </div>
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default RoleSelection;
