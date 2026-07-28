'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, KeyRound, ArrowRight, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import { authApi, setTokens } from '@/lib/api';
import { motion } from 'framer-motion';

export default function VerifyOtpPage() {
  const router = useRouter();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const storedUserId = localStorage.getItem('tempUserId') || '';
    const storedEmail = localStorage.getItem('tempEmail') || '';
    setUserId(storedUserId);
    setEmail(storedEmail);

    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP.');
      return;
    }

    setLoading(true);

    try {
      const res = await authApi.verifyOtp({ email, userId, otp });

      if (res.data?.success && res.data?.accessToken) {
        setTokens(res.data.accessToken, res.data.refreshToken, res.data.user?.role);
        localStorage.removeItem('tempUserId');
        localStorage.removeItem('tempEmail');

        const role = res.data.user?.role || 'CUSTOMER';
        if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
          router.push('/admin');
        } else {
          router.push('/dashboard');
        }
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      setError(errorObj.response?.data?.error || 'Invalid or expired OTP code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    setCountdown(60);
    setError('');
  };

  const fillDemoOtp = () => {
    setOtp('123456');
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-8">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="glass-card p-8 rounded-2xl relative overflow-hidden border-border/80 shadow-glass text-center">
          {/* Header */}
          <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center mx-auto mb-3 text-primary shadow-glow-cyan">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-white">Multi-Factor Verification</h2>
          <p className="text-sm text-gray-400 mt-1">
            We sent a 6-digit cryptographic OTP to <span className="text-white font-mono">{email || 'your email'}</span>
          </p>

          {/* Error Banner */}
          {error && (
            <div className="my-4 p-3.5 rounded-xl bg-danger/15 border border-danger/40 flex items-start gap-3 text-danger text-sm text-left">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-3 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="• • • • • •"
                  className="input-field pl-11 text-center font-mono text-xl tracking-[0.5em]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 font-semibold"
            >
              {loading ? (
                <span>Verifying Cryptographic Proof...</span>
              ) : (
                <>
                  <span>Verify & Unlock Vault</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Countdown & Resend */}
          <div className="mt-6 flex items-center justify-between text-xs text-gray-400">
            <span>Code expires in: <strong className="text-white font-mono">{countdown}s</strong></span>
            <button
              type="button"
              disabled={countdown > 0}
              onClick={handleResend}
              className={`flex items-center gap-1.5 ${
                countdown > 0 ? 'text-gray-600 cursor-not-allowed' : 'text-primary hover:underline'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Resend Code</span>
            </button>
          </div>

          {/* Quick Demo OTP */}
          <div className="mt-6 pt-5 border-t border-border/60">
            <button
              type="button"
              onClick={fillDemoOtp}
              className="w-full py-2 px-3 rounded-lg bg-surface border border-border/80 hover:border-primary/50 text-xs text-gray-300 font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Use Test Sandbox OTP (123456)</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
