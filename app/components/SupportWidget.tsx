'use client';

import { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';

export default function SupportWidget() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="mb-3 w-80 bg-charcoal border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-white/5">
            <span className="text-sm font-semibold text-cream">Support</span>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-cream">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4">
            <p className="text-sm text-cream/50">
              Need help? Contact our support team via the help center or email support@novatrade.com
            </p>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="w-12 h-12 bg-gradient-to-br from-gold to-gold/80 rounded-full flex items-center justify-center shadow-lg hover:shadow-gold/20 transition-all"
      >
        <MessageCircle className="w-5 h-5 text-void" />
      </button>
    </div>
  );
}
