'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Mail, Phone, Lock, CreditCard, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { authApi } from '@/lib/api';
import { motion } from 'framer-motion';

export default function RegisterPage() {
  const router = useRouter();
  const [nic, setNic] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Sri Lankan NIC Validation: either 9 digits + V/X or 12 digits
  const isValidNic = /^(?:[0-9]{9}[vVxX]|[0-9]{12})$/.test(nic.trim());

  // Password strength score (0 - 4)
  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score;
  };

  const strengthScore = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isValidNic) {
      setError('Invalid Sri Lankan NIC format. Enter 9 digits + V/X (e.g., 981234567V) or 12 digits (e.g., 200412345678).');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (strengthScore < 3) {
      setError('Please choose a stronger password with uppercase letters, numbers, and symbols.');
      return;
    }

    setLoading(true);

    try {
      const res = await authApi.register({
        nic: nic.trim().toUpperCase(),
        email: email.trim(),
        phone: phone.trim(),
        password
      });

      if (res.data?.success) {
        router.push('/login?registered=true');
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: any; status?: number; statusText?: string } };
      const responseData = errorObj.response?.data;
      
      let errorMessage = 'Registration failed. Email, Phone, or NIC may already exist.';
      
      if (responseData) {
        if (typeof responseData === 'string' && responseData.includes('<html')) {
          errorMessage = `Service Unavailable (Proxy Error: ${errorObj.response?.status || 500}). Please check API connection.`;
        } else if (responseData.details && Array.isArray(responseData.details) && responseData.details.length > 0) {
          errorMessage = responseData.details.map((d: any) => d.message).join(' | ');
        } else if (responseData.error) {
          errorMessage = responseData.error;
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-8">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg"
      >
        <div className="glass-card p-8 rounded-2xl relative overflow-hidden border-border/80 shadow-glass">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center mx-auto mb-3 text-accent shadow-glow-emerald">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-bold text-white">Create AegisVault Account</h2>
            <p className="text-sm text-gray-400 mt-1">Join the zero-trust quantum banking platform</p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-danger/15 border border-danger/40 flex items-start gap-3 text-danger text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* NIC */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5 flex items-center justify-between">
                <span>National Identity Card (NIC)</span>
                {nic && (
                  <span className={`text-[10px] flex items-center gap-1 ${isValidNic ? 'text-emerald-400' : 'text-danger'}`}>
                    {isValidNic ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                    {isValidNic ? 'Valid Sri Lankan NIC' : 'Invalid Format'}
                  </span>
                )}
              </label>
              <div className="relative">
                <CreditCard className="absolute left-3.5 top-3 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  required
                  value={nic}
                  onChange={(e) => setNic(e.target.value)}
                  placeholder="200412345678 or 981234567V"
                  className="input-field pl-11 uppercase"
                />
              </div>
            </div>

            {/* Email & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-5 h-5 text-gray-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@domain.com"
                    className="input-field pl-11"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 w-5 h-5 text-gray-500" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+94771234567"
                    className="input-field pl-11"
                  />
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-5 h-5 text-gray-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="input-field pl-11"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-5 h-5 text-gray-500" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="input-field pl-11"
                  />
                </div>
              </div>
            </div>

            {/* Password Strength Indicator */}
            {password && (
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Password Security Level</span>
                  <span className={strengthScore >= 3 ? 'text-emerald-400 font-semibold' : 'text-warning font-semibold'}>
                    {strengthScore === 4 ? 'Quantum Resistant' : strengthScore === 3 ? 'Strong' : 'Weak'}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1 h-1.5 rounded-full overflow-hidden bg-surface">
                  <div className={`h-full ${strengthScore >= 1 ? 'bg-danger' : ''}`} />
                  <div className={`h-full ${strengthScore >= 2 ? 'bg-warning' : ''}`} />
                  <div className={`h-full ${strengthScore >= 3 ? 'bg-emerald-500' : ''}`} />
                  <div className={`h-full ${strengthScore >= 4 ? 'bg-primary' : ''}`} />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-accent py-3 mt-4 font-semibold"
            >
              {loading ? (
                <span>Creating Quantum Vault...</span>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer Link */}
          <div className="mt-6 text-center text-sm text-gray-400">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline font-semibold">
              Sign In
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
