'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Eye, 
  EyeOff, 
  Send, 
  CreditCard, 
  Landmark, 
  History, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertTriangle, 
  ShieldCheck, 
  RefreshCw 
} from 'lucide-react';
import { accountApi, txnApi } from '@/lib/api';
import { motion } from 'framer-motion';
import Cookies from 'js-cookie';

interface Account {
  id: string;
  accountNumber: string;
  accountType: string;
  balance: number | string;
  currency: string;
  status: string;
}

interface Transaction {
  id: string;
  referenceNumber: string;
  amount: number | string;
  type: string;
  status: string;
  fromAccountId: string;
  toAccountId: string;
  fraudFlag?: boolean;
  createdAt: string;
  description?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAcc, setSelectedAcc] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showBalance, setShowBalance] = useState(true);
  const [loading, setLoading] = useState(true);

  // Role-based redirect guard: Admins should be on /admin, not /dashboard
  useEffect(() => {
    const role = Cookies.get('userRole') || localStorage.getItem('userRole');
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
      router.replace('/admin');
    }
  }, [router]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [accRes, txnRes] = await Promise.all([
        accountApi.getAccounts().catch(() => null),
        txnApi.getTransactions({ limit: 8 }).catch(() => null)
      ]);

      if (accRes?.data?.success && Array.isArray(accRes.data.accounts) && accRes.data.accounts.length > 0) {
        setAccounts(accRes.data.accounts);
        const saved = typeof window !== 'undefined' ? localStorage.getItem('aegisvault_selected_account_number') : null;
        const matched = saved ? accRes.data.accounts.find((a: Account) => a.accountNumber === saved) : null;
        const chosen = matched || accRes.data.accounts[0];
        setSelectedAcc(chosen);
      } else {
        setAccounts([]);
        setSelectedAcc(null);
      }

      if (txnRes?.data?.success && Array.isArray(txnRes.data.transactions)) {
        setTransactions(txnRes.data.transactions);
      } else {
        setTransactions([]);
      }
    } catch {
      setAccounts([]);
      setSelectedAcc(null);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-8">
      {/* Top Banner & Account Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Customer Financial Vault
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Real-time ACID balances & SHA-256 protected transaction logs
          </p>
        </div>

        {accounts.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 uppercase tracking-wider">Account:</span>
            <select
              value={selectedAcc?.id || ''}
              onChange={(e) => {
                const acc = accounts.find((a) => a.id === e.target.value);
                if (acc) {
                  setSelectedAcc(acc);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('aegisvault_selected_account_number', acc.accountNumber);
                  }
                }
              }}
              className="bg-surface-card border border-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.accountType} •••• {acc.accountNumber.slice(-4)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main Balance Card */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 md:p-8 rounded-2xl relative overflow-hidden bg-gradient-to-br from-surface-card via-surface to-background border-border/80 shadow-glass"
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                {selectedAcc?.status || 'ACTIVE'}
              </span>
              <span className="text-xs font-mono text-gray-400">
                {selectedAcc?.accountType || 'SAVINGS'} ACC • {selectedAcc?.accountNumber || 'N/A'}
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
                {showBalance
                  ? `${Number(selectedAcc?.balance || 0).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} ${selectedAcc?.currency || 'LKR'}`
                  : `•••••••• ${selectedAcc?.currency || 'LKR'}`}
              </span>
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="p-1.5 rounded-lg bg-surface hover:bg-border/60 text-gray-400 hover:text-white transition-colors"
                title="Toggle balance visibility"
              >
                {showBalance ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Refresh Action */}
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="self-start md:self-center btn-outline text-xs py-2 px-3 gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
            <span>Sync ACID Ledger</span>
          </button>
        </div>
      </motion.div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Link
          href="/transfer"
          className="glass-card-hover p-5 rounded-xl flex flex-col items-center justify-center text-center group transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center mb-3 text-primary group-hover:scale-110 transition-transform">
            <Send className="w-6 h-6" />
          </div>
          <span className="font-semibold text-white text-sm">Send Money</span>
          <span className="text-xs text-gray-400 mt-0.5">ACID Atomic Transfer</span>
        </Link>

        <Link
          href="/payments"
          className="glass-card-hover p-5 rounded-xl flex flex-col items-center justify-center text-center group transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-3 text-emerald-400 group-hover:scale-110 transition-transform">
            <CreditCard className="w-6 h-6" />
          </div>
          <span className="font-semibold text-white text-sm">Pay Utility Bill</span>
          <span className="text-xs text-gray-400 mt-0.5">CEB / Water / Telecom</span>
        </Link>

        <Link
          href="/payments?tab=loans"
          className="glass-card-hover p-5 rounded-xl flex flex-col items-center justify-center text-center group transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center mb-3 text-cyan-400 group-hover:scale-110 transition-transform">
            <Landmark className="w-6 h-6" />
          </div>
          <span className="font-semibold text-white text-sm">Apply for Loan</span>
          <span className="text-xs text-gray-400 mt-0.5">Amortization Calculator</span>
        </Link>

        <Link
          href="/transactions"
          className="glass-card-hover p-5 rounded-xl flex flex-col items-center justify-center text-center group transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center mb-3 text-purple-400 group-hover:scale-110 transition-transform">
            <History className="w-6 h-6" />
          </div>
          <span className="font-semibold text-white text-sm">Ledger History</span>
          <span className="text-xs text-gray-400 mt-0.5">SHA-256 Receipts</span>
        </Link>
      </div>

      {/* Recent Transactions Section */}
      <div className="glass-card p-6 rounded-2xl border-border/80">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <span>Recent Ledger Activity</span>
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Verified against tamper-evident cryptographic chain</p>
          </div>
          <Link
            href="/transactions"
            className="text-xs font-semibold text-primary hover:underline"
          >
            View All Transactions →
          </Link>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">
            No recent transactions found on this account ledger.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/60 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Ref Number</th>
                  <th className="py-3 px-4">Type / Description</th>
                  <th className="py-3 px-4">Security Status</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-sm">
                {transactions
                  .filter((txn) => !selectedAcc || txn.fromAccountId === selectedAcc.accountNumber || txn.toAccountId === selectedAcc.accountNumber)
                  .map((txn) => {
                  const isCredit = txn.toAccountId === selectedAcc?.accountNumber;
                  return (
                    <tr key={txn.id} className="hover:bg-surface-card/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs text-gray-300">
                        {txn.referenceNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{txn.type}</span>
                          {txn.description && (
                            <span className="text-xs text-gray-400 hidden sm:inline">
                              — {txn.description}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              txn.status === 'SUCCESS'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-warning/15 text-warning border border-warning/30'
                            }`}
                          >
                            {txn.status}
                          </span>
                          {txn.fraudFlag && (
                            <span
                              className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-danger/20 text-danger border border-danger/40 flex items-center gap-1"
                              title="Flagged by Rule-Based Velocity Guard"
                            >
                              <AlertTriangle className="w-3 h-3" />
                              <span>FLAGGED</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-400">
                        {new Date(txn.createdAt).toLocaleDateString()}{' '}
                        {new Date(txn.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold">
                        <span className={`inline-flex items-center gap-1 ${isCredit ? 'text-emerald-400' : 'text-white'}`}>
                          {isCredit ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4 text-gray-400" />}
                          {isCredit ? '+' : '-'}{' '}
                          {Number(txn.amount).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          LKR
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
