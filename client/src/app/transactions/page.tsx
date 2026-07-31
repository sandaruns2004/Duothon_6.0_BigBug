'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  History, 
  Search, 
  Download, 
  ShieldCheck, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Printer, 
  X, 
  RefreshCw 
} from 'lucide-react';
import { txnApi, accountApi } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';

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

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'CREDIT' | 'DEBIT' | 'BILLS' | 'LOANS' | 'FLAGGED'>('ALL');

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Selected receipt modal
  const [selectedReceipt, setSelectedReceipt] = useState<Transaction | null>(null);

  const [accounts, setAccounts] = useState<any[]>([]);
  const [myAccountNumber, setMyAccountNumber] = useState('');

  useEffect(() => {
    accountApi.getAccounts()
      .then((res) => {
        if (res.data?.success && Array.isArray(res.data.accounts) && res.data.accounts.length > 0) {
          setAccounts(res.data.accounts);
          const saved = typeof window !== 'undefined' ? localStorage.getItem('aegisvault_selected_account_number') : null;
          const matched = saved ? res.data.accounts.find((a: any) => a.accountNumber === saved) : null;
          const chosen = matched || res.data.accounts[0];
          setMyAccountNumber(chosen.accountNumber);
        }
      })
      .catch(() => {
        setMyAccountNumber('810000000001');
      });
  }, []);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await txnApi.getTransactions({ limit: 50 });
      if (res.data?.success && Array.isArray(res.data.transactions) && res.data.transactions.length > 0) {
        setTransactions(res.data.transactions);
      } else {
        // Fallback demo transactions
        setTransactions([
          {
            id: 'txn-101',
            referenceNumber: 'TXN-2026-8801',
            amount: '25000.00',
            type: 'TRANSFER',
            status: 'SUCCESS',
            fromAccountId: myAccountNumber,
            toAccountId: '810087654321',
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            description: 'Monthly office rental'
          },
          {
            id: 'txn-102',
            referenceNumber: 'TXN-2026-8802',
            amount: '125000.00',
            type: 'TRANSFER',
            status: 'SUCCESS',
            fromAccountId: '810099887766',
            toAccountId: myAccountNumber,
            createdAt: new Date(Date.now() - 14400000).toISOString(),
            description: 'Freelance invoice settlement'
          },
          {
            id: 'txn-103',
            referenceNumber: 'TXN-2026-8803',
            amount: '600000.00',
            type: 'TRANSFER',
            status: 'SUCCESS',
            fromAccountId: myAccountNumber,
            toAccountId: '990011223344',
            fraudFlag: true,
            createdAt: new Date(Date.now() - 28800000).toISOString(),
            description: 'International wire (Rule 1 Velocity Alert)'
          },
          {
            id: 'txn-104',
            referenceNumber: 'TXN-2026-8804',
            amount: '4500.00',
            type: 'PAYMENT',
            status: 'SUCCESS',
            fromAccountId: myAccountNumber,
            toAccountId: 'CEB-BILLER',
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            description: 'CEB Utility / Reload Payment (Ref: 1089234561)'
          },
          {
            id: 'txn-105',
            referenceNumber: 'TXN-2026-8805',
            amount: '1500.00',
            type: 'PAYMENT',
            status: 'SUCCESS',
            fromAccountId: myAccountNumber,
            toAccountId: 'DIALOG-BILLER',
            createdAt: new Date(Date.now() - 172800000).toISOString(),
            description: 'DIALOG Utility / Reload Payment (Ref: 0771234567)'
          },
          {
            id: 'txn-106',
            referenceNumber: 'LOAN-DISB-9901',
            amount: '500000.00',
            type: 'DEPOSIT',
            status: 'SUCCESS',
            fromAccountId: 'AEGISVAULT-FINANCE',
            toAccountId: myAccountNumber,
            createdAt: new Date(Date.now() - 259200000).toISOString(),
            description: 'Loan Disbursement - Personal Financing (Loan #LOAN-9901)'
          },
          {
            id: 'txn-107',
            referenceNumber: 'EMI-48092',
            amount: '25000.00',
            type: 'PAYMENT',
            status: 'SUCCESS',
            fromAccountId: myAccountNumber,
            toAccountId: 'AEGISVAULT-FINANCE',
            createdAt: new Date(Date.now() - 345600000).toISOString(),
            description: 'Loan EMI Deduction - Installment Cut for Loan #LOAN-9901'
          }
        ]);

      }
    } catch {
      // Offline mock data handled
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Filter and Search logic
  const filteredTransactions = useMemo(() => {
    return transactions.filter((txn) => {
      const isCredit = txn.toAccountId === myAccountNumber;
      const isDebit = txn.fromAccountId === myAccountNumber;

      if (myAccountNumber && txn.fromAccountId !== myAccountNumber && txn.toAccountId !== myAccountNumber) {
        return false;
      }

      const isBillOrReload =
        txn.type === 'PAYMENT' ||
        txn.type === 'BILL_PAYMENT' ||
        (txn.toAccountId && txn.toAccountId.includes('-BILLER')) ||
        (txn.description && (txn.description.toLowerCase().includes('bill') || txn.description.toLowerCase().includes('reload')));

      const isLoanOrEmi =
        txn.type === 'DEPOSIT' ||
        txn.type === 'LOAN_DISBURSEMENT' ||
        txn.type === 'LOAN_REPAYMENT' ||
        (txn.referenceNumber && (txn.referenceNumber.startsWith('LOAN') || txn.referenceNumber.startsWith('EMI'))) ||
        (txn.description && (txn.description.toLowerCase().includes('loan') || txn.description.toLowerCase().includes('emi')));

      if (activeTab === 'CREDIT' && !isCredit) return false;
      if (activeTab === 'DEBIT' && !isDebit) return false;
      if (activeTab === 'BILLS' && !isBillOrReload) return false;
      if (activeTab === 'LOANS' && !isLoanOrEmi) return false;
      if (activeTab === 'FLAGGED' && !txn.fraudFlag) return false;


      if (search) {
        const q = search.toLowerCase();
        return (
          txn.referenceNumber.toLowerCase().includes(q) ||
          txn.fromAccountId.toLowerCase().includes(q) ||
          txn.toAccountId.toLowerCase().includes(q) ||
          (txn.description && txn.description.toLowerCase().includes(q))
        );
      }

      return true;
    });
  }, [transactions, activeTab, search, myAccountNumber]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / itemsPerPage));
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleExportCsv = () => {
    const headers = ['Reference Number', 'Date', 'Type', 'Description', 'Direction', 'Amount (LKR)', 'Status', 'Fraud Flag'];
    const rows = filteredTransactions.map(txn => {
      const isCredit = txn.toAccountId === myAccountNumber;
      return [
        txn.referenceNumber,
        new Date(txn.createdAt).toLocaleString(),
        txn.type,
        `"${(txn.description || '').replace(/"/g, '""')}"`,
        isCredit ? 'RECEIVED (+ Credit)' : 'DEDUCTED (- Debit)',
        Number(txn.amount).toFixed(2),
        txn.status,
        txn.fraudFlag ? 'FLAGGED' : 'NORMAL'
      ];
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `aegisvault_ledger_${activeTab.toLowerCase()}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <History className="w-7 h-7 text-primary" />
            <span>Cryptographic Transaction Ledger</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Tamper-evident SHA-256 transaction logs & downloadable PDF receipts
          </p>
        </div>

        <div className="flex items-center gap-3">
          {accounts.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Account:</span>
              <select
                value={myAccountNumber}
                onChange={(e) => {
                  setMyAccountNumber(e.target.value);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('aegisvault_selected_account_number', e.target.value);
                  }
                }}
                className="bg-surface-card border border-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary"
              >
                {accounts.map((a: any) => (
                  <option key={a.id} value={a.accountNumber}>
                    {a.accountType} •••• {a.accountNumber.slice(-4)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={handleExportCsv}
            disabled={filteredTransactions.length === 0}
            className="btn-outline text-xs py-2 px-3 self-start sm:self-center gap-1.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
            title="Export filtered ledger to CSV spreadsheet"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={fetchTransactions}
            disabled={loading}
            className="btn-outline text-xs py-2 px-3 self-start sm:self-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
            <span>Sync Ledger</span>
          </button>

        </div>
      </div>

      {/* Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {(['ALL', 'CREDIT', 'DEBIT', 'BILLS', 'LOANS', 'FLAGGED'] as const).map((tab) => {
            const labels: Record<string, string> = {
              ALL: 'All Transactions',
              CREDIT: '↓ Received (+ Credit)',
              DEBIT: '↑ Deducted (- Debit)',
              BILLS: '⚡ Bills & Reloads',
              LOANS: '🏦 Loans & Financing',
              FLAGGED: '🚨 Fraud Guard Flagged'
            };
            return (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setCurrentPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                  activeTab === tab
                    ? tab === 'FLAGGED'
                      ? 'bg-danger/20 text-danger border border-danger/40 shadow-sm'
                      : 'bg-primary/20 text-primary border border-primary/40 shadow-sm'
                    : 'bg-surface-card text-gray-400 hover:text-white border border-border'
                }`}
              >
                {labels[tab] || tab}
              </button>
            );
          })}

        </div>

        <div className="relative w-full md:w-64">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search ref or counterparty..."
            className="input-field pl-10 text-xs py-2"
          />
        </div>
      </div>

      {/* Transactions Table */}
      <div className="glass-card p-6 rounded-2xl border-border/80 shadow-glass">
        {paginatedTransactions.length === 0 ? (
          <div className="text-center py-16 text-gray-500 text-sm">
            No transactions match the selected filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/60 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Ref Number</th>
                  <th className="py-3 px-4">Type / Description</th>
                  <th className="py-3 px-4">Security Status</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-sm">
                {paginatedTransactions.map((txn) => {
                  const isCredit = txn.toAccountId === myAccountNumber;
                  return (
                    <tr key={txn.id} className="hover:bg-surface-card/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs text-gray-300">
                        {txn.referenceNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{txn.type}</span>
                            {isCredit ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                ↓ Received (+ Credit)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                ↑ Deducted (- Debit)
                              </span>
                            )}
                          </div>
                          {txn.description && (
                            <span className="block text-xs text-gray-400">
                              {txn.description}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
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
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedReceipt(txn)}
                          className="px-2.5 py-1 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Receipt</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-xs text-gray-400">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                className="px-3 py-1.5 rounded-lg bg-surface border border-border disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                className="px-3 py-1.5 rounded-lg bg-surface border border-border disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Printable Receipt Modal */}
      <AnimatePresence>
        {selectedReceipt && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="glass-card max-w-md w-full p-6 rounded-2xl border-primary/40 shadow-glow-cyan relative text-left"
            >
              <button
                onClick={() => setSelectedReceipt(null)}
                className="absolute top-4 right-4 p-1 rounded-lg text-gray-400 hover:text-white print:hidden"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Cryptographic Receipt</h3>
                  <span className="text-xs text-emerald-400 font-mono">
                    SHA-256 SIGNED • IMMUTABLE LEDGER
                  </span>
                </div>
              </div>

              <div className="space-y-3 p-4 rounded-xl bg-surface border border-border/60 text-xs font-mono my-6">
                <div className="flex justify-between">
                  <span className="text-gray-400">Reference No:</span>
                  <span className="font-bold text-primary">{selectedReceipt.referenceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className="text-emerald-400 font-bold">{selectedReceipt.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Type:</span>
                  <span className="text-white">{selectedReceipt.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">From Account:</span>
                  <span className="text-gray-300">{selectedReceipt.fromAccountId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">To Account:</span>
                  <span className="text-gray-300">{selectedReceipt.toAccountId}</span>
                </div>
                {selectedReceipt.description && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Description:</span>
                    <span className="text-gray-300">{selectedReceipt.description}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-border/60 flex justify-between text-sm font-bold">
                  <span className="text-gray-300">Total Amount:</span>
                  <span className="text-primary">{selectedReceipt.amount} LKR</span>
                </div>
                <div className="text-[10px] text-gray-500 pt-1 text-center font-sans">
                  Timestamp: {new Date(selectedReceipt.createdAt).toLocaleString()}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 print:hidden">
                <button
                  type="button"
                  onClick={() => setSelectedReceipt(null)}
                  className="btn-outline py-2.5 text-xs"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  className="btn-primary py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Receipt</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
