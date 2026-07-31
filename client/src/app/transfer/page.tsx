'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Send, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  X, 
  DollarSign, 
  User, 
  FileText, 
  Lock 
} from 'lucide-react';
import { accountApi } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';

interface Account {
  id: string;
  accountNumber: string;
  accountType: string;
  balance: number | string;
  currency: string;
  status: string;
}

export default function TransferPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    accountApi.getAccounts()
      .then((res) => {
        if (res.data?.success && Array.isArray(res.data.accounts) && res.data.accounts.length > 0) {
          setAccounts(res.data.accounts);
          const saved = typeof window !== 'undefined' ? localStorage.getItem('aegisvault_selected_account_number') : null;
          const matched = saved ? res.data.accounts.find((a: Account) => a.accountNumber === saved) : null;
          const chosen = matched || res.data.accounts[0];
          setFromAccount(chosen.accountNumber);
        }
      })
      .catch(() => {
        const demoAcc: Account = {
          id: 'acc-demo-1',
          accountNumber: '810000000001',
          accountType: 'SAVINGS',
          balance: 1500000,
          currency: 'LKR',
          status: 'ACTIVE'
        };
        setAccounts([demoAcc]);
        setFromAccount(demoAcc.accountNumber);
      });
  }, []);

  // Confirmation Modal & Success Receipt State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState<{
    referenceNumber?: string;
    fromAccount?: string;
    toAccount?: string;
    amount?: string;
    fee?: string;
    timestamp?: string;
  } | null>(null);

  const numAmount = parseFloat(amount) || 0;
  const transferFee = numAmount > 100000 ? numAmount * 0.005 : 0;
  const totalDebit = numAmount + transferFee;

  const handleValidateForm = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!toAccount || toAccount.length < 8) {
      setError('Please enter a valid recipient account number (12 digits).');
      return;
    }

    if (numAmount <= 0) {
      setError('Transfer amount must be greater than zero.');
      return;
    }

    if (fromAccount.trim() === toAccount.trim()) {
      setError('Cannot transfer funds to the same source account number.');
      return;
    }

    const currentAcc = accounts.find(a => a.accountNumber === fromAccount);
    if (currentAcc && Number(currentAcc.balance) < totalDebit) {
      setError(`Insufficient funds in selected account (Available: ${Number(currentAcc.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} LKR, required: ${totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} LKR).`);
      return;
    }

    setShowConfirmModal(true);
  };

  const handleExecuteTransfer = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await accountApi.executeTransfer({
        fromAccountNumber: fromAccount,
        toAccountNumber: toAccount,
        amount: numAmount,
        currency: 'LKR',
        description: description || 'ACID Interbank Transfer'
      });

      if (res.data?.success) {
        // Update local balance immediately
        setAccounts(prev => prev.map(a => 
          a.accountNumber === fromAccount 
            ? { ...a, balance: Number(a.balance) - totalDebit }
            : a
        ));
        setShowConfirmModal(false);
        window.dispatchEvent(new Event('notification-updated'));
        setSuccessReceipt({
          referenceNumber: res.data.transaction?.referenceNumber || `TXN-${Date.now().toString().slice(-6)}`,
          fromAccount,
          toAccount,
          amount: numAmount.toFixed(2),
          fee: transferFee.toFixed(2),
          timestamp: new Date().toLocaleString()
        });
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      setError(
        errorObj.response?.data?.error || 'ACID Atomic Transfer failed. Insufficient funds or invalid recipient.'
      );
      setShowConfirmModal(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <Send className="w-7 h-7 text-primary" />
          <span>Send Money (ACID Transfer)</span>
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Guaranteed atomic execution with rollback on failure & velocity anomaly guard
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-danger/15 border border-danger/40 flex items-start gap-3 text-danger text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Transfer Form Card */}
      <div className="glass-card p-6 md:p-8 rounded-2xl border-border/80 shadow-glass">
        <form onSubmit={handleValidateForm} className="space-y-5">
          {/* Sender Account */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300">
                From Account (Source Ledger)
              </label>
              {accounts.length > 0 && (
                <span className="text-xs text-emerald-400 font-mono font-medium">
                  Available: {Number(accounts.find(a => a.accountNumber === fromAccount)?.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} LKR
                </span>
              )}
            </div>
            {accounts.length > 1 ? (
              <select
                value={fromAccount}
                onChange={(e) => {
                  setFromAccount(e.target.value);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('aegisvault_selected_account_number', e.target.value);
                  }
                }}
                className="input-field font-mono text-sm bg-surface-card text-white border-border focus:border-primary"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.accountNumber}>
                    {acc.accountType} — #{acc.accountNumber} ({Number(acc.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {acc.currency})
                  </option>
                ))}
              </select>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  required
                  disabled
                  value={fromAccount}
                  readOnly
                  className="input-field font-mono text-sm bg-gray-900/80 text-gray-400 border-gray-800 cursor-not-allowed select-none"
                  title="Source account number is automatically locked to your active ledger account"
                />
                <span className="absolute right-3.5 top-2.5 text-xs text-primary font-semibold uppercase tracking-wider">
                  {accounts[0]?.accountType || 'SAVINGS'}
                </span>
              </div>
            )}
            <p className="text-[11px] text-gray-500 mt-1">
              {accounts.length > 1 
                ? 'Select any of your active AegisVault accounts as the debit source' 
                : 'Locked to your authenticated primary account'}
            </p>
          </div>

          {/* Recipient Account */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5 flex items-center justify-between">
              <span>To Recipient Account Number</span>
              <span className="text-[11px] text-primary">12-Digit Interbank Vault Account</span>
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-3 w-5 h-5 text-gray-500" />
              <input
                type="text"
                required
                value={toAccount}
                onChange={(e) => setToAccount(e.target.value.replace(/\D/g, ''))}
                placeholder="810087654321 or 990011223344"
                className="input-field pl-11 font-mono text-sm"
              />
            </div>
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                Amount (LKR)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3.5 top-3 w-5 h-5 text-gray-500" />
                <input
                  type="number"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="25000.00"
                  className="input-field pl-11 font-mono text-lg font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                Currency
              </label>
              <input
                type="text"
                disabled
                value="LKR (Rupee)"
                className="input-field bg-surface-card/40 text-gray-400 font-medium text-sm cursor-not-allowed"
              />
            </div>
          </div>

          {/* Dynamic Fee & Total Summary */}
          {numAmount > 0 && (
            <div className="p-4 rounded-xl bg-surface border border-border/80 space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>Transfer Amount:</span>
                <span className="font-mono text-white">{numAmount.toFixed(2)} LKR</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Network Processing Fee (0.5% &gt; 100k):</span>
                <span className="font-mono text-emerald-400">{transferFee.toFixed(2)} LKR</span>
              </div>
              <div className="pt-2 border-t border-border/60 flex justify-between font-bold text-sm text-white">
                <span>Total Debit Account Balance:</span>
                <span className="font-mono text-primary">{totalDebit.toFixed(2)} LKR</span>
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
              Reference / Description (Optional)
            </label>
            <div className="relative">
              <FileText className="absolute left-3.5 top-3 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Monthly rent / vendor invoice payment"
                className="input-field pl-11 text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full btn-primary py-3 font-semibold mt-4"
          >
            <span>Review & Confirm Transfer</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* ACID Transfer Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="glass-card max-w-md w-full p-6 rounded-2xl border-border/80 shadow-glass relative"
            >
              <button
                onClick={() => setShowConfirmModal(false)}
                className="absolute top-4 right-4 p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center mb-4 text-primary">
                <Lock className="w-6 h-6" />
              </div>

              <h3 className="text-xl font-bold text-white">Confirm ACID Atomic Transfer</h3>
              <p className="text-xs text-gray-400 mt-1">
                Please verify the interbank transfer details below. This operation will commit to the PostgreSQL serializable ledger.
              </p>

              <div className="my-5 space-y-2.5 p-4 rounded-xl bg-surface border border-border/60 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">From Account:</span>
                  <span className="font-mono text-white">{fromAccount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">To Recipient:</span>
                  <span className="font-mono text-cyan-300 font-semibold">{toAccount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Amount:</span>
                  <span className="font-mono text-white font-bold">{numAmount.toFixed(2)} LKR</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Fee:</span>
                  <span className="font-mono text-emerald-400">{transferFee.toFixed(2)} LKR</span>
                </div>
                <div className="pt-2 border-t border-border/60 flex justify-between text-sm font-bold">
                  <span className="text-gray-300">Total Deduction:</span>
                  <span className="font-mono text-primary">{totalDebit.toFixed(2)} LKR</span>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-6 text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">
                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                <span>100% ACID Guaranteed — rollback on network or balance error.</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="btn-outline py-2.5 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteTransfer}
                  disabled={loading}
                  className="btn-primary py-2.5 text-xs font-semibold"
                >
                  {loading ? 'Executing...' : 'Confirm Transfer'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transfer Success Receipt Modal */}
      <AnimatePresence>
        {successReceipt && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="glass-card max-w-md w-full p-6 rounded-2xl border-emerald-500/40 shadow-glow-emerald text-center relative"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto mb-4 text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <h3 className="text-xl font-bold text-white">Transfer Successful!</h3>
              <p className="text-xs text-gray-400 mt-1">
                Your funds were atomically transferred and signed in the cryptographic SHA-256 audit log.
              </p>

              <div className="my-5 p-4 rounded-xl bg-surface border border-border/60 space-y-2 text-xs text-left">
                <div className="flex justify-between">
                  <span className="text-gray-400">Reference Number:</span>
                  <span className="font-mono font-bold text-primary">{successReceipt.referenceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Recipient Account:</span>
                  <span className="font-mono text-white">{successReceipt.toAccount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Amount Transferred:</span>
                  <span className="font-mono text-emerald-400 font-bold">{successReceipt.amount} LKR</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Timestamp:</span>
                  <span className="text-gray-300">{successReceipt.timestamp}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="btn-outline py-2.5 text-xs"
                >
                  Return to Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/transactions')}
                  className="btn-primary py-2.5 text-xs font-semibold"
                >
                  View Receipts
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
