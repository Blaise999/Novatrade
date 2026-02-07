'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  LayoutDashboard,
  LineChart,
  Wallet,
  Users,
  Settings,
  Bell,
  Search,
  Menu,
  X,
  ChevronDown,
  LogOut,
  User,
  Shield,
  HelpCircle,
  CreditCard,
  History,
  Bitcoin,
  DollarSign,
  BarChart3,
  Copy
} from 'lucide-react';
import { useStore } from '@/lib/supabase/store-supabase';
import { useUIStore, useNotificationStore } from '@/lib/store';

const navigation = [
  { 
    name: 'Dashboard', 
    href: '/dashboard', 
    icon: LayoutDashboard 
  },
  { 
    name: 'Trade', 
    icon: LineChart,
    children: [
      { name: 'Cryptocurrency', href: '/dashboard/trade/crypto', icon: Bitcoin },
      { name: 'Forex', href: '/dashboard/trade/fx', icon: DollarSign },
      { name: 'Stocks', href: '/dashboard/trade/stocks', icon: BarChart3 },
    ]
  },
  { 
    icon: Copy 
  },
  { 
    name: 'Portfolio', 
    href: '/dashboard/portfolio', 
    icon: BarChart3 
  },
  { 
    name: 'Wallet', 
    href: '/dashboard/wallet', 
    icon: Wallet 
  },
  { 
    name: 'History', 
    href: '/dashboard/history', 
    icon: History 
  },
];

const bottomNav = [
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  { name: 'Help', href: '/dashboard/help', icon: HelpCircle },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isAuthenticated, isLoading } = useStore();
  const { sidebarOpen, toggleSidebar, mobileMenuOpen, toggleMobileMenu } = useUIStore();
  const { unreadCount } = useNotificationStore();
  
  const [expandedMenu, setExpandedMenu] = useState<string | null>('Trade');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isLoading, isAuthenticated, router]);

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const isActive = (href: string) => pathname === href;
  const isChildActive = (children: any[]) => children?.some(child => pathname === child.href);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void flex">
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col fixed inset-y-0 left-0 z-50 bg-obsidian border-r border-white/5 transition-all duration-300 ${
        sidebarOpen ? 'w-64' : 'w-20'
      }`}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/5">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-gold to-gold/60 rounded-xl flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-6 h-6 text-void" />
            </div>
            {sidebarOpen && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xl font-display font-bold text-cream"
              >
                NOVA<span className="text-gold">TRADE</span>
              </motion.span>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {navigation.map((item) => (
              <li key={item.name}>
                {item.children ? (
                  <div>
                    <button
                      onClick={() => setExpandedMenu(expandedMenu === item.name ? null : item.name)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                        isChildActive(item.children)
                          ? 'bg-gold/10 text-gold'
                          : 'text-slate-400 hover:text-cream hover:bg-white/5'
                      }`}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {sidebarOpen && (
                        <>
                          <span className="flex-1 text-left text-sm font-medium">{item.name}</span>
                          <ChevronDown className={`w-4 h-4 transition-transform ${
                            expandedMenu === item.name ? 'rotate-180' : ''
                          }`} />
                        </>
                      )}
                    </button>
                    
                    <AnimatePresence>
                      {sidebarOpen && expandedMenu === item.name && (
                        <motion.ul
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden ml-4 mt-1 space-y-1"
                        >
                          {item.children.map((child) => (
                            <li key={child.name}>
                              <Link
                                href={child.href}
                                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                                  isActive(child.href)
                                    ? 'bg-gold/10 text-gold'
                                    : 'text-slate-400 hover:text-cream hover:bg-white/5'
                                }`}
                              >
                                <child.icon className="w-4 h-4" />
                                <span className="text-sm">{child.name}</span>
                              </Link>
                            </li>
                          ))}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                      isActive(item.href)
                        ? 'bg-gold/10 text-gold'
                        : 'text-slate-400 hover:text-cream hover:bg-white/5'
                    }`}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {sidebarOpen && (
                      <span className="text-sm font-medium">{item.name}</span>
                    )}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* Bottom Navigation */}
        <div className="border-t border-white/5 py-4 px-3">
          <ul className="space-y-1">
            {bottomNav.map((item) => (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                    isActive(item.href)
                      ? 'bg-gold/10 text-gold'
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

          {/* Collapse Button */}
          <button
            onClick={toggleSidebar}
            className="w-full mt-4 flex items-center justify-center gap-2 px-3 py-2 text-slate-500 hover:text-cream transition-colors"
          >
            <ChevronDown className={`w-5 h-5 transition-transform ${sidebarOpen ? 'rotate-90' : '-rotate-90'}`} />
            {sidebarOpen && <span className="text-sm">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={toggleMobileMenu}
              className="lg:hidden fixed inset-0 bg-void/80 backdrop-blur-sm z-40"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              className="lg:hidden fixed inset-y-0 left-0 w-72 bg-obsidian border-r border-white/5 z-50 flex flex-col"
            >
              {/* Mobile Logo */}
              <div className="h-16 flex items-center justify-between px-4 border-b border-white/5">
                <Link href="/dashboard" className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-gold to-gold/60 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-void" />
                  </div>
                  <span className="text-xl font-display font-bold text-cream">
                    NOVA<span className="text-gold">TRADE</span>
                  </span>
                </Link>
                <button onClick={toggleMobileMenu} className="p-2 text-slate-400">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Mobile Navigation */}
              <nav className="flex-1 overflow-y-auto py-4 px-3">
                <ul className="space-y-1">
                  {navigation.map((item) => (
                    <li key={item.name}>
                      {item.children ? (
                        <div>
                          <button
                            onClick={() => setExpandedMenu(expandedMenu === item.name ? null : item.name)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                              isChildActive(item.children)
                                ? 'bg-gold/10 text-gold'
                                : 'text-slate-400 hover:text-cream hover:bg-white/5'
                            }`}
                          >
                            <item.icon className="w-5 h-5" />
                            <span className="flex-1 text-left text-sm font-medium">{item.name}</span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${
                              expandedMenu === item.name ? 'rotate-180' : ''
                            }`} />
                          </button>
                          
                          <AnimatePresence>
                            {expandedMenu === item.name && (
                              <motion.ul
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden ml-4 mt-1 space-y-1"
                              >
                                {item.children.map((child) => (
                                  <li key={child.name}>
                                    <Link
                                      href={child.href}
                                      onClick={toggleMobileMenu}
                                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                                        isActive(child.href)
                                          ? 'bg-gold/10 text-gold'
                                          : 'text-slate-400 hover:text-cream hover:bg-white/5'
                                      }`}
                                    >
                                      <child.icon className="w-4 h-4" />
                                      <span className="text-sm">{child.name}</span>
                                    </Link>
                                  </li>
                                ))}
                              </motion.ul>
                            )}
                          </AnimatePresence>
                        </div>
                      ) : (
                        <Link
                          href={item.href}
                          onClick={toggleMobileMenu}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                            isActive(item.href)
                              ? 'bg-gold/10 text-gold'
                              : 'text-slate-400 hover:text-cream hover:bg-white/5'
                          }`}
                        >
                          <item.icon className="w-5 h-5" />
                          <span className="text-sm font-medium">{item.name}</span>
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
        sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
      }`}>
        {/* Top Header */}
        <header className="h-16 bg-obsidian/50 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
          {/* Left */}
          <div className="flex items-center gap-4">
            <button
              onClick={toggleMobileMenu}
              className="lg:hidden p-2 text-slate-400 hover:text-cream transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            
            {/* Search */}
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/5">
              <Search className="w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search assets, traders..."
                className="bg-transparent text-sm text-cream placeholder:text-slate-500 focus:outline-none w-48 lg:w-64"
              />
              <kbd className="hidden lg:inline text-xs text-slate-500 px-1.5 py-0.5 bg-white/5 rounded">⌘K</kbd>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-3">
            {/* Balance */}
            <div className="hidden sm:block px-4 py-2 bg-white/5 rounded-xl border border-white/5">
              <p className="text-xs text-slate-500">Balance</p>
              <p className="text-sm font-semibold text-cream">
                ${(user?.balance || 0).toLocaleString()}
                {(user?.bonusBalance || 0) > 0 && (
                  <span className="text-profit text-xs ml-1">+${user?.bonusBalance || 0}</span>
                )}
              </p>
            </div>

            {/* Deposit Button */}
            <Link
              href="/dashboard/wallet"
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gold to-gold/80 text-void text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-gold/20 transition-all"
            >
              <CreditCard className="w-4 h-4" />
              Deposit
            </Link>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-slate-400 hover:text-cream transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-loss text-void text-xs font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            </div>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-white/5 transition-colors"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-gold/20 to-electric/20 rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4 text-gold" />
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
              </button>

              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-56 bg-charcoal border border-white/10 rounded-xl shadow-2xl overflow-hidden"
                  >
                    <div className="p-3 border-b border-white/5">
                      <p className="text-sm font-medium text-cream">
                        {user.firstName || user.email.split('@')[0]}
                      </p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                    <div className="py-2">
                      <Link
                        href="/dashboard/settings"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-3 px-4 py-2 text-sm text-slate-400 hover:text-cream hover:bg-white/5 transition-colors"
                      >
                        <User className="w-4 h-4" />
                        Profile
                      </Link>
                      <Link
                        href="/dashboard/settings"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-3 px-4 py-2 text-sm text-slate-400 hover:text-cream hover:bg-white/5 transition-colors"
                      >
                        <Shield className="w-4 h-4" />
                        Security
                      </Link>
                      <Link
                        href="/dashboard/settings"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-3 px-4 py-2 text-sm text-slate-400 hover:text-cream hover:bg-white/5 transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        Settings
                      </Link>
                    </div>
                    <div className="border-t border-white/5 py-2">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-loss hover:bg-loss/10 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
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
