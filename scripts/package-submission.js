#!/usr/bin/env node

/**
 * ═══════════════════════════════════════════════════════════════════
 * AegisVault Digital Banking Platform — Submission Packager
 * Creates a clean ZIP archive ready for duothan.ieeensbm.org
 * Excludes node_modules, .next, .env, and temporary logs.
 * Usage: node scripts/package-submission.js
 * ═══════════════════════════════════════════════════════════════════
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const outputZipName = 'AegisVault_Duothan6.0_Submission.zip';
const outputZipPath = path.join(rootDir, outputZipName);
https://github.com/sandaruns2004/Duothon_6.0_BigBug
console.log('📦 [AegisVault Packager] Preparing clean submission ZIP archive...');

try {
  // Remove older archive if exists
  if (fs.existsSync(outputZipPath)) {
    fs.unlinkSync(outputZipPath);
  }

  // Attempt to use git archive first as it respects .gitignore automatically
  try {
    console.log('  👉 Executing: git archive -o AegisVault_Duothan6.0_Submission.zip HEAD');
    execSync(`git archive -o "${outputZipPath}" HEAD`, { cwd: rootDir, stdio: 'inherit' });
    console.log(`\n🎉 [SUCCESS] Submission package generated: ${outputZipName}`);
    console.log(`📁 Absolute Path: ${outputZipPath}`);
  } catch (gitErr) {
    console.log('  ℹ️ git archive fallback triggered (using PowerShell Compress-Archive)...');

    // PowerShell Compress-Archive command excluding node_modules and .next
    const psCmd = `powershell -NoProfile -Command "Get-ChildItem -Path '${rootDir}' -Exclude 'node_modules','.next','.git','*.zip','*.log' | Compress-Archive -DestinationPath '${outputZipPath}' -Force"`;
    execSync(psCmd, { stdio: 'inherit' });
    console.log(`\n🎉 [SUCCESS] Submission package generated: ${outputZipName}`);
    console.log(`📁 Absolute Path: ${outputZipPath}`);
  }

  console.log('───────────────────────────────────────────────────────────────────');
  console.log('🚀 Your package is ready for upload to duothan.ieeensbm.org!');
  console.log('───────────────────────────────────────────────────────────────────\n');
} catch (error) {
  console.error('❌ Failed to create submission ZIP archive:', error.message);
}
