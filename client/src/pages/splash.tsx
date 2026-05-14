import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { ScanBarcode } from 'lucide-react';

const TypewriterText = ({ text }: { text: string }) => {
  const characters = Array.from(text);

  return (
    <div className="flex justify-center">
      {characters.map((char, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: 0.1,
            delay: index * 0.1,
            ease: "easeIn"
          }}
          className="bg-gradient-to-r from-white via-primary-200 to-white bg-clip-text text-transparent"
        >
          {char}
        </motion.span>
      ))}
    </div>
  );
};

const SplashScreen: React.FC = () => {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const timer = setTimeout(() => {
      setLocation('/role-selection');
    }, 4500); // Increased slightly to allow typing animation to finish

    return () => clearTimeout(timer);
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary-700/20 via-black to-primary-700/20"></div>

      <div className="relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-4xl md:text-6xl font-black mb-8 tracking-tighter"
        >
          <TypewriterText text="SmartPOS+" />
        </motion.div>

        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8, type: "spring", stiffness: 100 }}
          className="relative"
        >
          <div className="absolute inset-0 bg-primary-500/20 blur-3xl rounded-full"></div>
          <ScanBarcode className="w-24 h-24 relative z-10 mx-auto filter drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] text-white" />
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
          className="mt-8 text-primary-200/60 text-sm font-light tracking-[0.3em] uppercase"
        >
          when technology meets enterprises
        </motion.p>

      </div>

      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.5, duration: 3, ease: "easeInOut" }}
        className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary-500 to-transparent opacity-50"
      />
    </div>
  );
};

export default SplashScreen;
