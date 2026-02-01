'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  LayoutDashboard,
  Users,
  Signal,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Bell,
  Activity,
  Wallet,
  TrendingUp,
  Calendar,
  Database,
  CreditCard
} from 'lucide-react';
import { useAdminAuthStore } from '@/lib/admin-store';

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Balances', href: '/admin/balances', icon: Wallet },
  { name: 'Trades', href: '/admin/trades', icon: TrendingUp },
  { name: 'Deposits', href: '/admin/deposits', icon: CreditCard },
  { name: 'Withdrawals', href: '/admin/withdrawals', icon: Database },
  { name: 'Markets', href: '/admin/markets', icon: Activity },
  { name: 'Education', href: '/admin/education', icon: Calendar },
  { name: 'Sessions', href: '/admin/sessions', icon: Signal },
  { name: 'Audit Log', href: '/admin/audit', icon: Shield },
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Redirect to login if not authenticated (except for login page)
  useEffect(() => {
    if (!isAuthenticated && pathname !== '/admin/login') {
      router.push('/admin/login');
    }
  }, [isAuthenticated, pathname, router]);

  const handleLogout = () => {
    logout();
    router.push('/admin/login');
  };

  // Show only login page content without layout
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  // Show loading or redirect for unauthenticated users
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-loss border-t-transparent rounded-full" />
      </div>
    );
  }

  const isActive = (href: string) => pathname === href;

  return (
    <div className="min-h-screen bg-void flex">
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col fixed inset-y-0 left-0 z-50 bg-obsidian border-r border-loss/20 transition-all duration-300 ${
        sidebarOpen ? 'w-64' : 'w-20'
      }`}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-loss/20">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-loss to-loss/60 rounded-xl flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6 text-white" />
            </div>
            {sidebarOpen && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xl font-display font-bold text-cream"
              >
                ADMIN<span className="text-loss">PANEL</span>
              </motion.span>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {navigation.map((item) => (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                    isActive(item.href)
                      ? 'bg-loss/10 text-loss'
                      : 'text-slate-400 hover:text-cream hover:bg-white/5'
                  }`}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {sidebarOpen && (
                    <span className="text-sm font-medium">{item.name}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Admin Info */}
        {sidebarOpen && admin && (
          <div className="p-4 border-t border-loss/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-loss/20 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-loss" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-cream truncate">{admin.name}</p>
                <p className="text-xs text-slate-500 truncate">{admin.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-loss/10 text-loss rounded-lg hover:bg-loss/20 transition-all text-sm"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        )}

        {/* Toggle Button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-3 top-20 w-6 h-6 bg-charcoal border border-loss/20 rounded-full flex items-center justify-center text-slate-400 hover:text-cream"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${sidebarOpen ? '-rotate-90' : 'rotate-90'}`} />
        </button>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-16 bg-obsidian/95 backdrop-blur border-b border-loss/20 flex items-center justify-between px-4">
        <Link href="/admin" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-loss rounded-lg flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold text-cream">ADMIN</span>
        </Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-400"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

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
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              className="lg:hidden fixed inset-y-0 left-0 w-72 bg-obsidian border-r border-loss/20 z-50 pt-20"
            >
              <nav className="p-4">
                <ul className="space-y-1">
                  {navigation.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                          isActive(item.href)
                            ? 'bg-loss/10 text-loss'
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
              {admin && (
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-loss/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-loss/20 rounded-lg flex items-center justify-center">
                      <Shield className="w-5 h-5 text-loss" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-cream">{admin.name}</p>
                      <p className="text-xs text-slate-500">{admin.role}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-loss/10 text-loss rounded-lg text-sm"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
        sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
      }`}>
        {/* Top Header */}
        <header className="h-16 bg-obsidian/50 backdrop-blur-xl border-b border-loss/10 hidden lg:flex items-center justify-between px-6 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-cream">
              {navigation.find(n => isActive(n.href))?.name || 'Admin Panel'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-profit/10 rounded-lg">
              <Activity className="w-4 h-4 text-profit" />
              <span className="text-xs text-profit font-medium">System Online</span>
            </div>
            <button className="p-2 text-slate-400 hover:text-cream relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-loss rounded-full" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 pt-20 lg:pt-6">
          {children}
        </main>
      </div>
    </div>
  );
}
