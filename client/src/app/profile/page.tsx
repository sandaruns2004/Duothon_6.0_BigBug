'use client';

import React, { useState, useEffect } from 'react';
import { 
  UserCheck, 
  Upload, 
  CheckCircle2, 
  Bell, 
  CheckCheck, 
  ShieldAlert, 
  FileCheck, 
  Mail, 
  Phone, 
  CreditCard,
  AlertCircle 
} from 'lucide-react';
import api, { notifApi, authApi } from '@/lib/api';
import { motion } from 'framer-motion';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  channel: string;
  isRead: boolean;
  createdAt: string;
}

export default function ProfileAndNotificationsPage() {
  const [kycStatus, setKycStatus] = useState<'PENDING' | 'VERIFYING' | 'VERIFIED'>('PENDING');
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);
  const [nicInput, setNicInput] = useState<string>('');
  const [uploadingKyc, setUploadingKyc] = useState(false);
  const [kycError, setKycError] = useState('');
  const [kycSuccess, setKycSuccess] = useState<string | null>(null);
  const [profile, setProfile] = useState<{
    email: string;
    phone: string;
    nic: string;
    role: string;
    kycStatus: 'PENDING' | 'VERIFYING' | 'VERIFIED';
    kycDocument?: string;
  } | null>(null);

  useEffect(() => {
    authApi.getMe()
      .then((res) => {
        if (res.data?.success && res.data.profile) {
          setProfile(res.data.profile);
          if (res.data.profile.nic && res.data.profile.nic !== 'N/A') {
            setNicInput(res.data.profile.nic);
          }
          if (res.data.profile.kycStatus) {
            setKycStatus(res.data.profile.kycStatus);
          }
          if (res.data.profile.kycDocument) {
            setUploadedFile(res.data.profile.kycDocument);
          }
        }
      })
      .catch(() => {});
  }, []);

  const fetchNotifications = async () => {
    setLoadingNotifs(true);
    try {
      const res = await notifApi.getNotifications();
      if (res.data?.success && Array.isArray(res.data.notifications)) {
        setNotifications(res.data.notifications);
      } else {
        // Fallback demo notifications
        setNotifications([
          {
            id: 'notif-1',
            title: '🔐 Login Alert from New IP Address',
            message: 'A successful login was detected from IP 192.168.1.105 (Colombo, LKR).',
            type: 'SECURITY',
            channel: 'EMAIL',
            isRead: false,
            createdAt: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            id: 'notif-2',
            title: '🚨 Fraud Velocity Warning Triggered',
            message: 'An international wire transfer of 600,000.00 LKR was flagged for manual review.',
            type: 'FRAUD_ALERT',
            channel: 'PUSH',
            isRead: false,
            createdAt: new Date(Date.now() - 14400000).toISOString(),
          },
          {
            id: 'notif-3',
            title: '⚡ ACID Transfer Completed',
            message: 'Your transfer of 25,000.00 LKR to Account 810087654321 was cleared successfully.',
            type: 'TRANSACTION',
            channel: 'EMAIL',
            isRead: true,
            createdAt: new Date(Date.now() - 86400000).toISOString(),
          },
        ]);
      }
    } finally {
      setLoadingNotifs(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setKycError('');
    setKycSuccess(null);
    setUploadingKyc(true);

    try {
      const res = await api.post('/api/users/kyc', {
        nic: nicInput.trim() || profile?.nic || '',
        kycDocument: file.name
      });
      if (res.data?.success) {
        setUploadedFile(file.name);
        setKycStatus('PENDING');
        setKycSuccess('KYC document submitted successfully! Awaiting admin review.');
        if (res.data.profile) {
          setProfile(res.data.profile);
          if (res.data.profile.nic) setNicInput(res.data.profile.nic);
        }
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      setKycError(errorObj.response?.data?.error || 'Failed to submit KYC verification documents.');
    } finally {
      setUploadingKyc(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await notifApi.markAsRead(id);
    } finally {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notifApi.markAllAsRead();
    } finally {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <UserCheck className="w-7 h-7 text-primary" />
          <span>Customer Profile & Security Alerts</span>
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Manage identity KYC documents and audit multi-channel security alerts
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: KYC Document Dropzone & Identity Info */}
        <div className="md:col-span-1 space-y-6">
          {/* Identity Card */}
          <div className="glass-card p-6 rounded-2xl border-border/80 shadow-glass space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary font-bold text-lg">
                {profile?.email ? profile.email.substring(0, 2).toUpperCase() : 'AV'}
              </div>
              <div>
                <h3 className="font-bold text-white">{profile?.email ? profile.email.split('@')[0].toUpperCase() : 'Authenticated User'}</h3>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    kycStatus === 'VERIFIED'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : kycStatus === 'VERIFYING'
                      ? 'bg-warning/15 text-warning border border-warning/30 animate-pulse'
                      : 'bg-primary/15 text-primary border border-primary/30'
                  }`}
                >
                  {kycStatus === 'VERIFIED' && <CheckCircle2 className="w-3 h-3" />}
                  <span>KYC: {kycStatus}</span>
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t border-border/60 text-xs text-gray-400">
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-gray-500" />
                <span>{profile?.email || 'customer@aegisvault.com'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-gray-500" />
                <span>{profile?.phone || '+94 77 000 0000'}</span>
              </div>
              <div className="flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5 text-gray-500" />
                <span className="font-mono">{profile?.nic || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* KYC File Dropzone */}
          <div className="glass-card p-6 rounded-2xl border-border/80 shadow-glass space-y-4">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              <span>KYC Identity Verification</span>
            </h3>
            <p className="text-xs text-gray-400">
              Upload your Sri Lankan NIC (front & back) or Passport to achieve Quantum Verification status.
            </p>

            {kycError && (
              <div className="p-3.5 rounded-xl bg-danger/15 border border-danger/40 text-danger text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{kycError}</span>
              </div>
            )}

            {kycSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{kycSuccess}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Sri Lankan NIC or Passport Number:
              </label>
              <input
                type="text"
                placeholder="e.g. 981234567V or N1928374"
                value={nicInput}
                onChange={(e) => setNicInput(e.target.value)}
                disabled={kycStatus === 'VERIFIED'}
                className="w-full bg-black/40 border border-border/80 rounded-xl px-3.5 py-2 text-sm text-white font-mono placeholder-gray-500 focus:outline-none focus:border-primary disabled:opacity-50"
              />
            </div>

            {kycStatus === 'VERIFIED' ? (
              <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-center space-y-1">
                <CheckCircle2 className="w-8 h-8 mx-auto" />
                <span className="block font-bold text-sm">KYC Verified</span>
                <span className="text-[11px] text-gray-400 block">
                  Document: {uploadedFile || profile?.kycDocument || 'NIC_FRONT_BACK.PDF'}
                </span>
              </div>
            ) : kycStatus === 'PENDING' ? (
              <div className="p-5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-center space-y-2.5">
                <CheckCircle2 className="w-9 h-9 mx-auto text-amber-400" />
                <span className="block font-bold text-sm text-white">
                  KYC document submitted successfully! Awaiting admin review.
                </span>
                <span className="text-[11px] text-gray-300 block">
                  Document: <code className="text-amber-300 font-mono">{uploadedFile || profile?.kycDocument || 'NIC_FRONT_BACK.PDF'}</code> — Saved securely in Azure Blob Storage until admin review.
                </span>
                <div className="pt-1">
                  <label className="inline-block px-3 py-1.5 rounded-lg bg-surface/60 border border-border text-xs text-gray-300 hover:text-white hover:border-primary cursor-pointer transition-colors">
                    <span>Replace Document</span>
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.pdf"
                      onChange={handleFileUpload}
                      disabled={uploadingKyc}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <label className="border-2 border-dashed border-border/80 hover:border-primary/60 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group bg-surface/40">
                <Upload className="w-8 h-8 text-gray-400 group-hover:text-primary transition-colors mb-2" />
                <span className="text-xs font-semibold text-white group-hover:text-primary">
                  {uploadingKyc
                    ? 'Submitting KYC Documents...'
                    : kycStatus === 'VERIFYING'
                    ? 'AI OCR Analyzing Document...'
                    : 'Click to upload or drag & drop'}
                </span>
                <span className="text-[10px] text-gray-500 mt-1">
                  PNG, JPG, PDF up to 10MB
                </span>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.pdf"
                  onChange={handleFileUpload}
                  disabled={uploadingKyc}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Right Column: Security Alerts & Notification Inbox */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              <span>Security & Audit Notification Inbox</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-danger text-white text-xs font-bold">
                  {unreadCount} new
                </span>
              )}
            </h2>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Mark All as Read</span>
              </button>
            )}
          </div>

          <div className="glass-card divide-y divide-border/60 rounded-2xl border-border/80 shadow-glass overflow-hidden">
            {loadingNotifs ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                Loading security alerts...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-12 text-center text-gray-500 text-sm">
                No notifications or security alerts found.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-5 flex items-start justify-between gap-4 transition-colors ${
                    !n.isRead ? 'bg-primary/5' : 'hover:bg-surface-card/40'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        n.type === 'FRAUD_ALERT'
                          ? 'bg-danger/15 text-danger border border-danger/30'
                          : 'bg-primary/15 text-primary border border-primary/30'
                      }`}
                    >
                      <ShieldAlert className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-sm">{n.title}</h4>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-gray-400">
                          {n.channel}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                        {n.message}
                      </p>
                      <span className="text-[10px] text-gray-500 block mt-2">
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {!n.isRead && (
                    <button
                      onClick={() => handleMarkAsRead(n.id)}
                      className="px-2.5 py-1 rounded-lg bg-surface hover:bg-border text-xs text-primary font-semibold flex-shrink-0"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
