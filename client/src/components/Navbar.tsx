'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  ShieldCheck, 
  LayoutDashboard, 
  Send, 
  History, 
  CreditCard, 
  UserCheck, 
  ShieldAlert, 
  Bell, 
  LogOut, 
  Menu, 
  X 
} from 'lucide-react';
import { notifApi, authApi, clearTokens } from '@/lib/api';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<string>('CUSTOMER');
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('accessToken');
      const role = localStorage.getItem('userRole') || 'CUSTOMER';
      setIsLoggedIn(!!token);
      setUserRole(role);
    };

    checkAuth();

    const fetchUnread = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) return;
      try {
        const res = await notifApi.getNotifications();
        if (res.data?.success && Array.isArray(res.data.notifications)) {
          const unread = res.data.notifications.filter((n: { isRead: boolean }) => !n.isRead).length;
          setUnreadCount(unread);
        }
      } catch {
        // Silently catch offline/unauthorized notification poll errors
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 3000);
    window.addEventListener('notification-updated', fetchUnread);
    window.addEventListener('focus', fetchUnread);

    return () => {
      clearInterval(interval);
      window.removeEventListener('notification-updated', fetchUnread);
      window.removeEventListener('focus', fetchUnread);
    };
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore logout errors
    } finally {
      clearTokens();
      setIsLoggedIn(false);
      router.push('/login');
    }
  };

  const navLinks = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Transfer', href: '/transfer', icon: Send },
    { name: 'Transactions', href: '/transactions', icon: History },
    { name: 'Payments & Loans', href: '/payments', icon: CreditCard },
    { name: 'Profile & KYC', href: '/profile', icon: UserCheck },
  ];

  if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
    navLinks.push({ name: 'Admin Governance', href: '/admin', icon: ShieldAlert });
  }

  // Do not display Navbar on login/register routes for cleaner full-screen focus
  if (pathname === '/login' || pathname === '/register' || pathname === '/verify-otp') {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-lg border-b border-border/80 shadow-glass">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-emerald-500 flex items-center justify-center shadow-glow-cyan transition-transform duration-300 group-hover:scale-105">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-cyan-200 to-primary bg-clip-text text-transparent">
              AegisVault
            </span>
            <span className="block text-[10px] text-emerald-400 font-mono tracking-widest uppercase">
              Quantum-Resilient
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-primary/20 text-primary border border-primary/30 shadow-sm'
                    : 'text-gray-300 hover:text-white hover:bg-surface-card'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-gray-400'}`} />
                <span>{link.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Action Icons & User Controls */}
        <div className="hidden md:flex items-center gap-4">
          {isLoggedIn ? (
            <>
              {/* Notification Bell */}
              <Link
                href="/profile"
                className="relative p-2 rounded-lg bg-surface-card border border-border/60 hover:border-primary/50 transition-colors"
                title="Security Notifications"
              >
                <Bell className="w-5 h-5 text-gray-300" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </Link>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30 text-sm font-medium transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="btn-outline text-sm py-1.5 px-4">
                Sign In
              </Link>
              <Link href="/register" className="btn-primary text-sm py-1.5 px-4">
                Register
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-lg bg-surface-card border border-border text-gray-300"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-surface border-b border-border px-4 py-4 space-y-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium ${
                  isActive
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'text-gray-300 hover:bg-surface-card'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{link.name}</span>
              </Link>
            );
          })}
          {isLoggedIn ? (
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-danger/15 text-danger font-medium text-sm mt-2"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="btn-outline text-center text-sm py-2"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="btn-primary text-center text-sm py-2"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
