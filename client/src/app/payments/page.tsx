'use client';

import React, { useState } from 'react';
import { 
  CreditCard, 
  Landmark, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  Calculator, 
  Zap, 
  Droplet, 
  Wifi, 
  Smartphone 
} from 'lucide-react';
import { accountApi } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';

export default function PaymentsAndLoansPage() {
  const [activeTab, setActiveTab] = useState<'bills' | 'loans'>('bills');

  // Utility Bill Form State
  const [biller, setBiller] = useState('CEB');
  const [accountNumber, setAccountNumber] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billError, setBillError] = useState('');
  const [billLoading, setBillLoading] = useState(false);
  const [billSuccess, setBillSuccess] = useState<string | null>(null);

  // Loan Calculator State
  const [loanAmount, setLoanAmount] = useState(500000);
  const [interestRate, setInterestRate] = useState(14.5);
  const [tenorMonths, setTenorMonths] = useState(36);
  const [loanLoading, setLoanLoading] = useState(false);
  const [loanSuccess, setLoanSuccess] = useState<string | null>(null);
  const [loanError, setLoanError] = useState('');

  // Live Amortization Calculation (EMI formula)
  const calculateEMI = (amount: number, rate: number, months: number) => {
    const r = rate / (12 * 100);
    if (r === 0) return amount / months;
    const emi = (amount * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
    return isNaN(emi) ? 0 : emi;
  };

  const monthlyEMI = calculateEMI(loanAmount, interestRate, tenorMonths);
  const totalRepayment = monthlyEMI * tenorMonths;
  const totalInterest = totalRepayment - loanAmount;

  const handleBillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBillError('');
    setBillSuccess(null);

    const amountNum = parseFloat(billAmount);
    if (!accountNumber || amountNum <= 0) {
      setBillError('Please enter a valid biller account number and amount.');
      return;
    }

    setBillLoading(true);
    try {
      const res = await accountApi.payBill({
        accountNumber: '810023459812',
        billerId: biller,
        amount: amountNum,
        referenceNumber: `BILL-${Date.now().toString().slice(-6)}`
      });

      if (res.data?.success) {
        setBillSuccess(`Bill payment of ${amountNum.toFixed(2)} LKR to ${biller} successful! Receipt: ${res.data.transaction?.referenceNumber || 'TXN-BILL-881'}`);
        setAccountNumber('');
        setBillAmount('');
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      setBillError(errorObj.response?.data?.error || 'Bill payment failed. Please check account balance.');
    } finally {
      setBillLoading(false);
    }
  };

  const handleLoanSubmit = async () => {
    setLoanError('');
    setLoanSuccess(null);
    setLoanLoading(true);

    try {
      const res = await accountApi.applyLoan({
        accountNumber: '810023459812',
        amount: loanAmount,
        interestRate,
        tenorMonths,
        purpose: 'Personal Wealth Expansion'
      });

      if (res.data?.success) {
        setLoanSuccess(`Loan application of ${loanAmount.toLocaleString()} LKR submitted! Loan ID: ${res.data.loan?.id || 'LOAN-2026-901'}`);
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      setLoanError(errorObj.response?.data?.error || 'Failed to submit loan application.');
    } finally {
      setLoanLoading(false);
    }
  };

  const billers = [
    { id: 'CEB', name: 'Ceylon Electricity Board', icon: Zap, color: 'text-warning' },
    { id: 'NWSDB', name: 'National Water Board', icon: Droplet, color: 'text-primary' },
    { id: 'SLT', name: 'Sri Lanka Telecom (Fiber)', icon: Wifi, color: 'text-emerald-400' },
    { id: 'DIALOG', name: 'Dialog Axiata 5G', icon: Smartphone, color: 'text-purple-400' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <CreditCard className="w-7 h-7 text-primary" />
          <span>Bill Payments & Financing Vault</span>
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Pay utility bills instantly or calculate real-time loan amortization schedules
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-border/80 gap-6">
        <button
          onClick={() => setActiveTab('bills')}
          className={`pb-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'bills'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Utility Bill Payments</span>
        </button>
        <button
          onClick={() => setActiveTab('loans')}
          className={`pb-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'loans'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <Landmark className="w-4 h-4" />
          <span>Loan Amortization Calculator</span>
        </button>
      </div>

      {activeTab === 'bills' ? (
        /* Utility Bill Payments Tab */
        <div className="glass-card p-6 md:p-8 rounded-2xl border-border/80 shadow-glass space-y-6">
          <h2 className="text-xl font-bold text-white">Select Biller Institution</h2>

          {billError && (
            <div className="p-3.5 rounded-xl bg-danger/15 border border-danger/40 flex items-start gap-3 text-danger text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{billError}</span>
            </div>
          )}

          {billSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-start gap-3 text-emerald-400 text-sm">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{billSuccess}</span>
            </div>
          )}

          {/* Biller Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {billers.map((b) => {
              const Icon = b.icon;
              const isSelected = biller === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBiller(b.id)}
                  className={`p-4 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-2 ${
                    isSelected
                      ? 'bg-primary/15 border-primary shadow-glow-cyan text-white'
                      : 'bg-surface-card border-border/80 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  <Icon className={`w-7 h-7 ${b.color}`} />
                  <span className="font-semibold text-xs">{b.name}</span>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleBillSubmit} className="space-y-4 pt-4 border-t border-border/60">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                Biller Account / Contract Number
              </label>
              <input
                type="text"
                required
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="e.g. 1029384756"
                className="input-field font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                Bill Amount (LKR)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3.5 top-3 w-5 h-5 text-gray-500" />
                <input
                  type="number"
                  step="0.01"
                  required
                  value={billAmount}
                  onChange={(e) => setBillAmount(e.target.value)}
                  placeholder="4500.00"
                  className="input-field pl-11 font-mono text-lg font-bold"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={billLoading}
              className="w-full btn-primary py-3 font-semibold mt-2"
            >
              {billLoading ? 'Processing Bill Payment...' : 'Pay Bill Instantly'}
            </button>
          </form>
        </div>
      ) : (
        /* Loan Amortization Calculator Tab */
        <div className="glass-card p-6 md:p-8 rounded-2xl border-border/80 shadow-glass space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Calculator className="w-6 h-6 text-emerald-400" />
                <span>Quantum Amortization Simulator</span>
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Real-time interest rate & EMI installment schedule computation
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
              14.5% APR Fixed
            </span>
          </div>

          {loanError && (
            <div className="p-3.5 rounded-xl bg-danger/15 border border-danger/40 flex items-start gap-3 text-danger text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{loanError}</span>
            </div>
          )}

          {loanSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-start gap-3 text-emerald-400 text-sm">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{loanSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
            {/* Controls */}
            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-2">
                  <span className="text-gray-300">Loan Principal Amount:</span>
                  <span className="text-white font-mono">{loanAmount.toLocaleString()} LKR</span>
                </div>
                <input
                  type="range"
                  min={50000}
                  max={5000000}
                  step={50000}
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(Number(e.target.value))}
                  className="w-full accent-emerald-500 bg-surface h-2 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-2">
                  <span className="text-gray-300">Repayment Tenor:</span>
                  <span className="text-white font-mono">{tenorMonths} Months ({tenorMonths / 12} Years)</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[12, 24, 36, 60].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setTenorMonths(m)}
                      className={`py-2 rounded-lg text-xs font-semibold border ${
                        tenorMonths === m
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500'
                          : 'bg-surface border-border text-gray-400 hover:text-white'
                      }`}
                    >
                      {m}M
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                  Annual Interest Rate (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={interestRate}
                  onChange={(e) => setInterestRate(Number(e.target.value))}
                  className="input-field font-mono text-sm"
                />
              </div>
            </div>

            {/* Live Amortization Summary Card */}
            <div className="p-6 rounded-2xl bg-surface border border-border/80 flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 block mb-1">
                  Monthly Installment (EMI)
                </span>
                <span className="text-3xl font-extrabold text-emerald-400 font-mono tracking-tight">
                  {monthlyEMI.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} LKR
                </span>
                <span className="block text-xs text-gray-500 mt-1">
                  Due on the 1st of every month
                </span>
              </div>

              <div className="space-y-2 pt-4 border-t border-border/60 text-xs my-4">
                <div className="flex justify-between text-gray-400">
                  <span>Principal Amount:</span>
                  <span className="font-mono text-white">{loanAmount.toLocaleString()} LKR</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Total Interest Payable:</span>
                  <span className="font-mono text-warning">
                    {totalInterest.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} LKR
                  </span>
                </div>
                <div className="flex justify-between text-gray-400 font-bold pt-1 border-t border-border/40">
                  <span>Total Repayment:</span>
                  <span className="font-mono text-primary">
                    {totalRepayment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} LKR
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLoanSubmit}
                disabled={loanLoading}
                className="w-full btn-accent py-3 font-semibold text-sm"
              >
                {loanLoading ? 'Submitting Application...' : 'Apply for Financing Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
