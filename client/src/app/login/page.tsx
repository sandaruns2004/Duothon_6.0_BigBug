'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Mail, Lock, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';
import { authApi, setTokens } from '@/lib/api';
import { motion } from 'framer-motion';

export default function LoginPage() {
  console.log('Mounting login page');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await authApi.login({ email, password });

      if (res.data?.success) {
        if (res.data.mfaRequired || res.data.requireMfa) {
          localStorage.setItem('tempUserId', res.data.userId);
          localStorage.setItem('tempEmail', email);
          router.push('/verify-otp');
        } else if (res.data.accessToken) {
          setTokens(res.data.accessToken, res.data.refreshToken, res.data.user?.role);
          const role = res.data.user?.role || 'CUSTOMER';
          if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
            router.push('/admin');
          } else {
            router.push('/dashboard');
          }
        }
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: any; status?: number; statusText?: string } };
      let exactError = 'Invalid credentials or account locked. Please try again.';
      
      if (errorObj.response?.data) {
        if (typeof errorObj.response.data === 'string' && errorObj.response.data.includes('<html')) {
          // If the proxy returns an HTML page (e.g. 502/404 from Next.js server)
          exactError = `Service Unavailable (Proxy Error: ${errorObj.response.status || 500}). Please check API connection.`;
        } else if (errorObj.response.data.error) {
          // If the backend returns a JSON error message
          exactError = errorObj.response.data.error;
        }
      }
      
      setError(exactError);
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCustomer = () => {
    setEmail('customer1@aegisvault.com');
    setPassword('CustomerSecure2026!');
  };

  const fillDemoCustomer2 = () => {
    setEmail('customer2@aegisvault.com');
    setPassword('CustomerSecure2026!');
  };

  const fillDemoAdmin = () => {
    setEmail('admin@aegisvault.com');
    setPassword('AdminSecure2026!');
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-8">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="glass-card p-8 rounded-2xl relative overflow-hidden border-border/80 shadow-glass">
          {/* Subtle glow circle */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/20 rounded-full blur-2xl pointer-events-none"></div>

          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center mx-auto mb-3 text-primary shadow-glow-cyan">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-bold text-white">Sign In to AegisVault</h2>
            <p className="text-sm text-gray-400 mt-1">Enter your credentials to access your quantum vault</p>
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
                  placeholder="customer1@aegisvault.com"
                  className="input-field pl-11"
                />
              </div>
            </div>

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

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 mt-2 font-semibold"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In to Vault</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Login Credentials for Judges */}
          <div className="mt-6 pt-5 border-t border-border/60">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
              <span className="flex items-center gap-1.5 font-medium text-primary">
                <Sparkles className="w-3.5 h-3.5" /> Quick Evaluation Credentials
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={fillDemoCustomer}
                className="py-2 px-2 rounded-lg bg-surface border border-border/80 hover:border-primary/50 text-xs text-gray-300 font-medium transition-colors text-left"
              >
                <span className="block font-semibold text-white">Customer 1</span>
                <span className="text-[10px] text-gray-400 truncate block">customer1@aegisvault.com</span>
              </button>
              <button
                type="button"
                onClick={fillDemoCustomer2}
                className="py-2 px-2 rounded-lg bg-surface border border-border/80 hover:border-cyan-400/50 text-xs text-gray-300 font-medium transition-colors text-left"
              >
                <span className="block font-semibold text-cyan-400">Customer 2</span>
                <span className="text-[10px] text-gray-400 truncate block">customer2@aegisvault.com</span>
              </button>
              <button
                type="button"
                onClick={fillDemoAdmin}
                className="py-2 px-2 rounded-lg bg-surface border border-border/80 hover:border-emerald-500/50 text-xs text-gray-300 font-medium transition-colors text-left"
              >
                <span className="block font-semibold text-emerald-400">Admin</span>
                <span className="text-[10px] text-gray-400 truncate block">admin@aegisvault.com</span>
              </button>
            </div>
          </div>

          {/* Footer Link */}
          <div className="mt-6 text-center text-sm text-gray-400">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-primary hover:underline font-semibold">
              Create an Account
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
