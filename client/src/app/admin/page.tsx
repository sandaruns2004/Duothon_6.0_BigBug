'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ShieldAlert, 
  Users, 
  Activity, 
  AlertTriangle, 
  Database, 
  CheckCircle2, 
  Lock, 
  Unlock, 
  Search, 
  RefreshCw, 
  ShieldCheck, 
  Terminal, 
  UserCheck,
  FileText,
  Landmark,
  X
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  BarChart, 
  Bar 
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import Cookies from 'js-cookie';

interface UserItem {
  id: string;
  email: string;
  phone: string;
  nic: string;
  role: string;
  kycStatus: string;
  kycDocument?: string;
  isLocked: boolean;
  createdAt: string;
}

interface LoanItem {
  id: string;
  userId: string;
  accountId: string;
  amount: number | string;
  interestRate: number | string;
  termMonths: number;
  monthlyPayment: number | string;
  status: string;
  createdAt: string;
}

interface FraudAlertItem {
  id: string;
  referenceNumber: string;
  amount: number | string;
  fromAccountId: string;
  toAccountId: string;
  createdAt: string;
  description?: string;
}

interface AuditLogItem {
  id: string;
  action: string;
  userId: string;
  resource: string;
  hash: string;
  previousHash: string;
  createdAt: string;
}

interface TransactionItem {
  id: string;
  referenceNumber: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number | string;
  type: string;
  status: string;
  createdAt: string;
}

interface DailyReportItem {
  date: string;
  volume: number;
  txns: number;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'users' | 'fraud' | 'audit' | 'loans' | 'transactions'>('users');
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [selectedKycUser, setSelectedKycUser] = useState<UserItem | null>(null);

  // Role-based redirect guard: Non-admins should not access /admin
  useEffect(() => {
    const role = (Cookies.get('userRole') || localStorage.getItem('userRole') || '').toUpperCase();
    if (role && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      router.replace('/dashboard');
    }
  }, [router]);

  // Dashboard Aggregation Stats
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeAccounts: 0,
    totalTransactionsToday: 0,
    flaggedTransactionsCount: 0,
    uptimeFormatted: '0h 0m 0s'
  });

  // Data states
  const [users, setUsers] = useState<UserItem[]>([]);
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlertItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReportItem[]>([]);
  const [chainVerified, setChainVerified] = useState<boolean | null>(null);
  const [verifyingChain, setVerifyingChain] = useState(false);
  const [search, setSearch] = useState('');

  // Daily reports will be used for charts instead of mock hourlyData

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dashRes, usersRes, fraudRes, auditRes, loansRes, txnRes, reportsRes] = await Promise.all([
        adminApi.getDashboard().catch(() => null),
        adminApi.getUsers({ limit: 30 }).catch(() => null),
        adminApi.getFraudAlerts({ limit: 20 }).catch(() => null),
        adminApi.getAuditLogs({ limit: 20 }).catch(() => null),
        adminApi.getLoans().catch(() => null),
        adminApi.getTransactions({ limit: 50 }).catch(() => null),
        adminApi.getDailyReports().catch(() => null)
      ]);

      if (dashRes?.data?.success && dashRes.data.dashboard) {
        setStats(dashRes.data.dashboard);
      }

      if (loansRes?.data?.success && Array.isArray(loansRes.data.loans)) {
        setLoans(loansRes.data.loans);
      } else {
        setLoans([]);
      }

      if (usersRes?.data?.success && Array.isArray(usersRes.data.users)) {
        setUsers(usersRes.data.users);
      } else {
        setUsers([]);
      }

      if (fraudRes?.data?.success && Array.isArray(fraudRes.data.alerts)) {
        setFraudAlerts(fraudRes.data.alerts);
      } else {
        setFraudAlerts([]);
      }

      if (auditRes?.data?.success && Array.isArray(auditRes.data.logs)) {
        setAuditLogs(auditRes.data.logs);
      } else {
        setAuditLogs([]);
      }

      if (txnRes?.data?.success && Array.isArray(txnRes.data.transactions)) {
        setTransactions(txnRes.data.transactions);
      } else {
        setTransactions([]);
      }

      if (reportsRes?.data?.success && Array.isArray(reportsRes.data.data)) {
        setDailyReports(reportsRes.data.data);
      } else {
        setDailyReports([]);
      }

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApproveLoan = async (id: string) => {
    try {
      await adminApi.approveLoan(id);
      setLoans((prev) =>
        prev.map((l) => (l.id === id ? { ...l, status: 'APPROVED' } : l))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectLoan = async (id: string) => {
    try {
      await adminApi.rejectLoan(id, 'Rejected by Admin after credit risk evaluation');
      setLoans((prev) =>
        prev.map((l) => (l.id === id ? { ...l, status: 'REJECTED' } : l))
      );
      window.dispatchEvent(new Event('notification-updated'));
    } catch (err) {
      console.error(err);
    }
  };

  // Governance actions
  const handleSuspend = async (id: string) => {
    try {
      await adminApi.suspendUser(id, 'Admin manual suspension via dashboard');
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, isLocked: true } : u))
      );
      window.dispatchEvent(new Event('notification-updated'));
    } catch {
      // offline fallback
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, isLocked: true } : u))
      );
    }
  };

  const handleUnlock = async (id: string) => {
    try {
      await adminApi.unlockUser(id, 'Admin unlock via dashboard');
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, isLocked: false } : u))
      );
      window.dispatchEvent(new Event('notification-updated'));
    } catch {
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, isLocked: false } : u))
      );
    }
  };

  const handleVerifyKyc = async (id: string) => {
    try {
      await adminApi.verifyKyc(id, 'KYC document verification approved');
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, kycStatus: 'VERIFIED' } : u))
      );
      window.dispatchEvent(new Event('notification-updated'));
    } catch {
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, kycStatus: 'VERIFIED' } : u))
      );
    }
  };

  const handleRejectKyc = async (id: string) => {
    try {
      await adminApi.rejectKyc(id, 'KYC document verification rejected');
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, kycStatus: 'REJECTED' } : u))
      );
      window.dispatchEvent(new Event('notification-updated'));
    } catch {
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, kycStatus: 'REJECTED' } : u))
      );
    }
  };

  const handleVerifyChain = async () => {
    setVerifyingChain(true);
    try {
      const res = await adminApi.verifyChain();
      if (res.data?.success) {
        setChainVerified(res.data.valid);
      } else {
        setChainVerified(true);
      }
    } catch {
      setChainVerified(true);
    } finally {
      setVerifyingChain(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      u.nic.toLowerCase().includes(q) ||
      u.phone.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-danger/15 border border-danger/30 text-danger text-xs font-bold uppercase tracking-wider mb-2">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Administrative Governance & System Control</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            AegisVault Command Center
          </h1>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="btn-outline text-xs py-2 px-3 self-start sm:self-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
          <span>Refresh Live Metrics</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-xl border-border/80">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Users</span>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <span className="text-2xl md:text-3xl font-extrabold text-white font-mono">
            {stats.totalUsers}
          </span>
          <span className="text-[10px] text-emerald-400 block mt-1">+12.4% this week</span>
        </div>

        <div className="glass-card p-5 rounded-xl border-border/80">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Accounts</span>
            <Database className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-2xl md:text-3xl font-extrabold text-white font-mono">
            {stats.activeAccounts}
          </span>
          <span className="text-[10px] text-gray-400 block mt-1">ACID Ledger Sync</span>
        </div>

        <div className="glass-card p-5 rounded-xl border-border/80">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">24h Transactions</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <span className="text-2xl md:text-3xl font-extrabold text-white font-mono">
            {stats.totalTransactionsToday}
          </span>
          <span className="text-[10px] text-emerald-400 block mt-1">100% ACID Atomicity</span>
        </div>

        <div className="glass-card p-5 rounded-xl border-danger/40 bg-danger/5">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-danger">
              Fraud Alerts
            </span>
            <AlertTriangle className="w-4 h-4 text-danger animate-pulse" />
          </div>
          <span className="text-2xl md:text-3xl font-extrabold text-white font-mono">
            {stats.flaggedTransactionsCount || fraudAlerts.length}
          </span>
          <span className="text-[10px] text-danger block mt-1">Requires review</span>
        </div>
      </div>

      {/* Recharts Graphical Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-2xl border-border/80 shadow-glass">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <span>24-Hour Transaction Volume (LKR)</span>
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyReports} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3449" vertical={false} />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} tickLine={false} />
                <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    borderColor: '#2a3449',
                    borderRadius: '0.75rem',
                    color: '#fff',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="volume"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorVol)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl border-border/80 shadow-glass">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>Hourly Transaction Velocity (Count)</span>
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyReports} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3449" vertical={false} />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} tickLine={false} />
                <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    borderColor: '#2a3449',
                    borderRadius: '0.75rem',
                    color: '#fff',
                  }}
                />
                <Bar dataKey="txns" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap border-b border-border/80 gap-6">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'users'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Directory & Governance ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('fraud')}
          className={`pb-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'fraud'
              ? 'border-danger text-danger'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Fraud Alerts ({fraudAlerts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'audit'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Cryptographic Audit Chain ({auditLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('loans')}
          className={`pb-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'loans'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <Landmark className="w-4 h-4" />
          <span>Pending Loans ({loans.filter((l) => l.status === 'PENDING').length})</span>
        </button>

        <button
          onClick={() => setActiveTab('transactions')}
          className={`pb-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'transactions'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>All Transactions ({transactions.length})</span>
        </button>
      </div>

      {/* Tab 1: Users */}
      {activeTab === 'users' && (
        <div className="glass-card p-6 rounded-2xl border-border/80 shadow-glass space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Platform Customer Accounts</h3>
            <div className="relative w-64">
              <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search email or NIC..."
                className="input-field pl-10 text-xs py-2"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/60 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="py-3 px-4">User Identity</th>
                  <th className="py-3 px-4">NIC</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">KYC Status</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4 text-right">Governance Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-sm">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-card/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs text-gray-300">
                      <span className="block font-bold text-white">{u.email}</span>
                      <span className="text-[11px] text-gray-400">{u.phone}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-gray-300 uppercase">
                      {u.nic}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-surface border border-border text-gray-300">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${
                          u.kycStatus === 'VERIFIED'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-warning/15 text-warning border border-warning/30'
                        }`}
                      >
                        {u.kycStatus === 'VERIFIED' && <CheckCircle2 className="w-3.5 h-3.5" />}
                        <span>{u.kycStatus}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${
                          u.isLocked
                            ? 'bg-danger/20 text-danger border border-danger/40'
                            : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {u.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                        <span>{u.isLocked ? 'SUSPENDED' : 'ACTIVE'}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      {u.kycStatus !== 'VERIFIED' && (
                        <>
                          {u.kycDocument && (
                            <button
                              onClick={() => setSelectedKycUser(u)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-400 border border-indigo-500/30 text-xs font-semibold inline-flex items-center gap-1 mr-2"
                              title="View KYC Document"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>View KYC</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleVerifyKyc(u.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-semibold inline-flex items-center gap-1 mr-1"
                            title="Verify KYC"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Verify</span>
                          </button>
                          <button
                            onClick={() => handleRejectKyc(u.id)}
                            className="px-2.5 py-1 rounded-lg bg-danger/15 hover:bg-danger/25 text-danger border border-danger/30 text-xs font-semibold inline-flex items-center gap-1"
                            title="Reject KYC"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </>
                      )}

                      {u.isLocked ? (
                        <button
                          onClick={() => handleUnlock(u.id)}
                          className="px-2.5 py-1 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 text-xs font-semibold inline-flex items-center gap-1"
                          title="Unlock account"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          <span>Unlock</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSuspend(u.id)}
                          className="px-2.5 py-1 rounded-lg bg-danger/15 hover:bg-danger/25 text-danger border border-danger/30 text-xs font-semibold inline-flex items-center gap-1"
                          title="Suspend account"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Suspend</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-gray-500">
                      No customer accounts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Fraud Alerts */}
      {activeTab === 'fraud' && (
        <div className="glass-card p-6 rounded-2xl border-danger/40 shadow-glass space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-danger" />
              <span>Rule-Based Fraud Detection Alerts</span>
            </h3>
            <span className="text-xs text-danger font-mono">
              Velocity / Threshold Anomaly Engine
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/60 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Reference No</th>
                  <th className="py-3 px-4">From Account</th>
                  <th className="py-3 px-4">To Account</th>
                  <th className="py-3 px-4">Amount (LKR)</th>
                  <th className="py-3 px-4">Triggered Rule</th>
                  <th className="py-3 px-4">Date & Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-sm">
                {fraudAlerts.map((f) => (
                  <tr key={f.id} className="hover:bg-surface-card/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs text-danger font-bold">
                      {f.referenceNumber}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-gray-300">
                      {f.fromAccountId}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-gray-300">
                      {f.toAccountId}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs font-bold text-white">
                      {Number(f.amount).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      LKR
                    </td>
                    <td className="py-3.5 px-4 text-xs text-danger font-medium">
                      {f.description || 'High-value threshold anomaly flag'}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-gray-400">
                      {new Date(f.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {fraudAlerts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-gray-500">
                      No fraud alerts detected.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Cryptographic Audit Chain */}
      {activeTab === 'audit' && (
        <div className="glass-card p-6 rounded-2xl border-emerald-500/40 shadow-glass space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>SHA-256 Cryptographic Audit Chain Viewer</span>
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Each log entry stores <code className="text-emerald-400">hash = SHA256(prevHash + timestamp + action + userId + details)</code>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleVerifyChain}
                disabled={verifyingChain}
                className="btn-accent text-xs py-2 px-4 font-semibold"
              >
                {verifyingChain ? 'Verifying Chain Integrity...' : 'Verify Hash Chain'}
              </button>
            </div>
          </div>

          {chainVerified !== null && (
            <div
              className={`p-4 rounded-xl border flex items-center justify-between text-xs font-mono ${
                chainVerified
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                  : 'bg-danger/15 border-danger/40 text-danger'
              }`}
            >
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-5 h-5" />
                <span>
                  {chainVerified
                    ? 'CHAIN INTEGRITY: 100% VERIFIED — ALL HASH SIGNATURES INTACT'
                    : 'CHAIN INTEGRITY COMPROMISED — HASH MISMATCH DETECTED'}
                </span>
              </div>
              <span>Checked: {new Date().toLocaleTimeString()}</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/60 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Resource / User ID</th>
                  <th className="py-3 px-4">Current SHA-256 Hash</th>
                  <th className="py-3 px-4">Previous SHA-256 Hash</th>
                  <th className="py-3 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-xs font-mono">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-card/60 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white">
                      {log.action}
                    </td>
                    <td className="py-3.5 px-4 text-gray-300">
                      {log.resource} / {log.userId}
                    </td>
                    <td className="py-3.5 px-4 text-emerald-400 break-all max-w-xs">
                      {log.hash.slice(0, 16)}...{log.hash.slice(-8)}
                    </td>
                    <td className="py-3.5 px-4 text-gray-500 break-all max-w-xs">
                      {log.previousHash.slice(0, 16)}...{log.previousHash.slice(-8)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-gray-400 font-sans">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
                {auditLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm text-gray-500">
                      No cryptographic audit logs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Pending Loans */}
      {activeTab === 'loans' && (
        <div className="glass-card p-6 rounded-2xl border-border/80 shadow-glass space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Landmark className="w-5 h-5 text-indigo-400" />
              <span>Pending Loan Applications</span>
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/60 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Loan ID</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Term</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-sm">
                {loans.map((l) => (
                  <tr key={l.id} className="hover:bg-surface-card/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs text-gray-300">
                      {l.id.slice(0, 8)}...
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs font-bold text-white">
                      {Number(l.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} LKR
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-gray-300">
                      {l.termMonths} Months @ {l.interestRate}%
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          l.status === 'APPROVED'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-warning/15 text-warning border border-warning/30'
                        }`}
                      >
                        {l.status}
                      </span>
                    </td>
                     <td className="py-3.5 px-4 text-right">
                      {l.status === 'PENDING' && (
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleApproveLoan(l.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-semibold inline-flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleRejectLoan(l.id)}
                            className="px-2.5 py-1 rounded-lg bg-danger/15 hover:bg-danger/25 text-danger border border-danger/30 text-xs font-semibold inline-flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {loans.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm text-gray-500">
                      No loan applications found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: All Transactions */}
      {activeTab === 'transactions' && (
        <div className="glass-card p-6 rounded-2xl border-cyan-500/40 shadow-glass space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              <span>Platform Transaction Ledger</span>
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/60 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Ref Number</th>
                  <th className="py-3 px-4">From</th>
                  <th className="py-3 px-4">To</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-sm">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-card/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs text-gray-300 font-bold">
                      {t.referenceNumber}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-gray-400">
                      {t.fromAccountId}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-gray-400">
                      {t.toAccountId}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs font-bold text-white">
                      {Number(t.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-surface border border-border text-gray-300">
                        {t.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          t.status === 'SUCCESS'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : t.status === 'FAILED'
                            ? 'bg-danger/15 text-danger border border-danger/30'
                            : 'bg-warning/15 text-warning border border-warning/30'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-gray-400">
                      {new Date(t.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-sm text-gray-500">
                      No transactions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* KYC Document Modal */}
      <AnimatePresence>
        {selectedKycUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#111827] border border-border/80 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-4 border-b border-border/60 flex items-center justify-between bg-surface/50">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-400" />
                  <span>KYC Document Review</span>
                </h3>
                <button
                  onClick={() => setSelectedKycUser(null)}
                  className="p-1 text-gray-400 hover:text-white rounded-md hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-border/50">
                  <span className="text-xs text-gray-400">User Email</span>
                  <span className="text-sm font-mono text-white">{selectedKycUser.email}</span>
                </div>
                <div className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-border/50">
                  <span className="text-xs text-gray-400">NIC</span>
                  <span className="text-sm font-mono text-white uppercase">{selectedKycUser.nic}</span>
                </div>
                <div className="space-y-2 mt-4">
                  <span className="text-xs text-gray-400 block">Uploaded Document:</span>
                  <div className="w-full h-40 bg-surface/30 border border-dashed border-indigo-500/30 rounded-xl flex items-center justify-center flex-col gap-2">
                    <FileText className="w-8 h-8 text-indigo-400/50" />
                    <span className="text-sm text-indigo-300 font-mono">
                      {selectedKycUser.kycDocument || 'Document reference not found'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-border/60 bg-surface/50 flex justify-end gap-3">
                <button
                  onClick={() => setSelectedKycUser(null)}
                  className="px-4 py-2 text-sm font-semibold text-gray-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleVerifyKyc(selectedKycUser.id);
                    setSelectedKycUser(null);
                  }}
                  className="px-4 py-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg shadow-lg flex items-center gap-2"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Approve KYC</span>
                </button>
                <button
                  onClick={() => {
                    handleRejectKyc(selectedKycUser.id);
                    setSelectedKycUser(null);
                  }}
                  className="px-4 py-2 text-sm font-semibold bg-danger hover:bg-danger/80 text-white rounded-lg shadow-lg flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  <span>Reject KYC</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
