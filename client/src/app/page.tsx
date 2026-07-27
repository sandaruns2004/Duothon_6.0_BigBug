'use client';

import React from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, 
  Lock, 
  Zap, 
  ArrowRight, 
  Database, 
  Cpu, 
  Activity 
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function HomePage() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center py-10">
      {/* Hero Header */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="text-center max-w-4xl mx-auto space-y-6"
      >
        <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold tracking-wider uppercase shadow-glow-cyan">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <span>ACID-Compliant • Zero-Trust Quantum Banking</span>
        </motion.div>

        <motion.h1 variants={itemVariants} className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">
          Next-Generation{' '}
          <span className="bg-gradient-to-r from-primary via-cyan-300 to-emerald-400 bg-clip-text text-transparent">
            Cryptographic Banking
          </span>{' '}
          & Financial Resilience
        </motion.h1>

        <motion.p variants={itemVariants} className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
          Experience real-time ACID transactions, tamper-evident SHA-256 cryptographic audit trails, rule-based fraud detection, and ISO 8583 interbank clearing.
        </motion.p>

        {/* Call to Actions */}
        <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link href="/dashboard" className="btn-primary text-base px-8 py-3">
            <span>Launch Dashboard</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link href="/login" className="btn-outline text-base px-8 py-3">
            <span>Customer Sign In</span>
          </Link>
          <Link href="/register" className="btn-accent text-base px-8 py-3">
            <span>Open Account</span>
          </Link>
        </motion.div>
      </motion.div>

      {/* 3 Pillar Highlight Cards */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16"
      >
        <motion.div variants={itemVariants} className="glass-card-hover p-6 rounded-2xl relative overflow-hidden group">
          <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center mb-4 text-primary group-hover:scale-110 transition-transform">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Cryptographic SHA-256 Audit Chain</h3>
          <p className="text-sm text-gray-400 leading-relaxed">
            Every transaction and administrative action is bound into a mathematically immutable hash-chain, guaranteeing 0% data tampering and full forensic accountability.
          </p>
          <div className="mt-4 pt-4 border-t border-border/40 flex items-center gap-2 text-xs text-primary font-mono">
            <Activity className="w-4 h-4 animate-pulse" />
            <span>GENESIS_HASH • IMMUTABLE</span>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="glass-card-hover p-6 rounded-2xl relative overflow-hidden group">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-4 text-emerald-400 group-hover:scale-110 transition-transform">
            <Database className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">ACID Atomic Transfer Engine</h3>
          <p className="text-sm text-gray-400 leading-relaxed">
            Powered by PostgreSQL serializable transactions. Enjoy zero-possibility of race conditions, double spending, or phantom balances during high-concurrency spikes.
          </p>
          <div className="mt-4 pt-4 border-t border-border/40 flex items-center gap-2 text-xs text-emerald-400 font-mono">
            <Zap className="w-4 h-4" />
            <span>100% ACID • AUTOMATIC ROLLBACK</span>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="glass-card-hover p-6 rounded-2xl relative overflow-hidden group">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center mb-4 text-cyan-400 group-hover:scale-110 transition-transform">
            <Cpu className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Real-Time Fraud & ISO 8583 Clearing</h3>
          <p className="text-sm text-gray-400 leading-relaxed">
            Automated anomaly detection analyzes transaction velocity and amount thresholds in real-time while simulating ISO 8583 interbank clearing protocols.
          </p>
          <div className="mt-4 pt-4 border-t border-border/40 flex items-center gap-2 text-xs text-cyan-400 font-mono">
            <ShieldCheck className="w-4 h-4" />
            <span>99.9% ISO CLEARING • VELOCITY GUARD</span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
