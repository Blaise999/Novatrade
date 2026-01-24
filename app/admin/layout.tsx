'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  LayoutDashboard,
  Calendar,
  Signal,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Bell,
  Clock,
  Users,
  TrendingUp
} from 'lucide-react';
import { useAdminAuthStore, useAdminSessionStore } from '@/lib/admin-store';

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Sessions', href: '/admin/sessions', icon: Calendar },
  { name: 'Live Signals', href: '/admin/signals', icon: Signal },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, isAuthenticated, logout } = useAdminAuthStore();
  const { activeSession } = useAdminSessionStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check auth
  useEffect(() => {
    if (!isAuthenticated && pathname !== '/admin/login') {
      router.push('/admin/login');
    }
  }, [isAuthenticated, pathname, router]);

  // Don't show layout on login page
  if (pathname === '/admin/login') {
    return children;
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-loss border-t-transparent rounded-full" />
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    router.push('/admin/login');
  };

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-void flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-64 bg-obsidian border-r border-loss/20">
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-loss/20">
          <div className="w-10 h-10 bg-gradient-to-br from-loss to-loss/60 rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-lg font-display font-bold text-cream">ADMIN</span>
            <span className="block text-xs text-loss">Signal Control</span>
          </div>
        </div>

        {/* Active Session Banner */}
        {activeSession && (
          <div className="mx-4 mt-4 p-3 bg-profit/10 border border-profit/20 rounded-xl">
            <div className="flex items-center gap-2 text-profit text-xs font-medium mb-1">
              <span className="w-2 h-2 bg-profit rounded-full animate-pulse" />
              LIVE SESSION
            </div>
            <p className="text-cream text-sm font-medium">{activeSession.name}</p>
            <p className="text-slate-400 text-xs">{activeSession.assetSymbol}</p>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-4">
          <ul className="space-y-2">
            {navigation.map((item) => (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive(item.href)
                      ? 'bg-loss/10 text-loss border border-loss/20'
                      : 'text-slate-400 hover:text-cream hover:bg-white/5'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{item.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Admin Info & Logout */}
        <div className="border-t border-loss/20 p-4">
          <div className="flex items-center gap-3 px-2 mb-4">
            <div className="w-10 h-10 bg-loss/10 rounded-xl flex items-center justify-center">
              <span className="text-loss font-bold">{admin?.name?.[0] || 'A'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-cream truncate">{admin?.name}</p>
              <p className="text-xs text-slate-500 truncate">{admin?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-loss hover:bg-loss/10 rounded-xl transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden fixed inset-0 bg-void/80 backdrop-blur-sm z-40"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              className="lg:hidden fixed inset-y-0 left-0 w-72 bg-obsidian border-r border-loss/20 z-50"
            >
              {/* Same content as desktop sidebar */}
              <div className="h-16 flex items-center justify-between px-4 border-b border-loss/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-loss to-loss/60 rounded-xl flex items-center justify-center">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-lg font-display font-bold text-cream">ADMIN</span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-slate-400">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto py-6 px-4">
                <ul className="space-y-2">
                  {navigation.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                          isActive(item.href)
                            ? 'bg-loss/10 text-loss border border-loss/20'
                            : 'text-slate-400 hover:text-cream hover:bg-white/5'
                        }`}
                      >
                        <item.icon className="w-5 h-5" />
                        <span className="text-sm font-medium">{item.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="h-16 bg-obsidian/50 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-400 hover:text-cream transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-semibold text-cream">
              {navigation.find(n => isActive(n.href))?.name || 'Admin'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Current Time */}
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl">
              <Clock className="w-4 h-4 text-slate-500" />
              <span className="text-sm text-cream font-mono">
                {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* Quick Actions */}
            <Link
              href="/admin/sessions/new"
              className="flex items-center gap-2 px-4 py-2 bg-loss text-white text-sm font-semibold rounded-xl hover:bg-loss/90 transition-all"
            >
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">New Session</span>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
