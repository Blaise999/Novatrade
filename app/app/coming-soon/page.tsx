'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Construction,
  ArrowLeft,
  Bell,
  Sparkles,
  Clock,
  CheckCircle,
} from 'lucide-react';

export default function ComingSoonPage() {
  const pathname = usePathname();
  const featureName = pathname.split('/').pop()?.replace(/-/g, ' ') || 'Feature';
  
  return (
    <div className="min-h-screen bg-void flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center"
      >
        {/* Icon */}
        <div className="relative mb-8">
          <div className="w-24 h-24 bg-gradient-to-br from-gold/20 to-gold/5 rounded-full flex items-center justify-center mx-auto">
            <Construction className="w-12 h-12 text-gold" />
          </div>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3 }}
            className="absolute -top-2 -right-2 w-8 h-8 bg-electric rounded-full flex items-center justify-center"
          >
            <Sparkles className="w-4 h-4 text-void" />
          </motion.div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-cream mb-4 capitalize">
          {featureName}
        </h1>
        <p className="text-lg text-gold mb-2">Coming Soon</p>
        <p className="text-slate-400 mb-8">
          We&apos;re working hard to bring you this feature. Stay tuned for updates!
        </p>

        {/* Features Preview */}
        <div className="bg-white/5 rounded-2xl border border-white/10 p-6 mb-8 text-left">
          <h3 className="text-sm font-semibold text-cream mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gold" />
            What to expect
          </h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <CheckCircle className="w-4 h-4 text-profit mt-0.5 flex-shrink-0" />
              <span className="text-sm text-slate-400">
                Enhanced functionality and improved user experience
              </span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="w-4 h-4 text-profit mt-0.5 flex-shrink-0" />
              <span className="text-sm text-slate-400">
                Seamless integration with existing features
              </span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="w-4 h-4 text-profit mt-0.5 flex-shrink-0" />
              <span className="text-sm text-slate-400">
                Advanced tools and analytics
              </span>
            </li>
          </ul>
        </div>

        {/* Notify Button */}
        <div className="space-y-4">
          <button className="w-full py-3 bg-gold text-void font-semibold rounded-xl hover:bg-gold/90 transition-all flex items-center justify-center gap-2">
            <Bell className="w-4 h-4" />
            Notify Me When Ready
          </button>
          <Link 
            href="/"
            className="w-full py-3 bg-white/5 text-cream font-semibold rounded-xl hover:bg-white/10 transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Link>
        </div>

        {/* Footer */}
        <p className="text-xs text-slate-500 mt-8">
          Expected launch: Q2 2026
        </p>
      </motion.div>
    </div>
  );
}
