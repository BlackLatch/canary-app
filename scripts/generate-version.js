#!/usr/bin/env node

/**
 * Generate version.json with git commit info
 * Run during build to embed version info in the app
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  // Get git commit hash
  const commitHash = execSync('git rev-parse --short HEAD')
    .toString()
    .trim();

  // Get git commit date
  const commitDate = execSync('git log -1 --format=%cI')
    .toString()
    .trim();

  // Get git branch
  const branch = execSync('git rev-parse --abbrev-ref HEAD')
    .toString()
    .trim();

  const version = {
    commit: commitHash,
    date: commitDate,
    branch: branch,
    buildTime: new Date().toISOString(),
  };

  // Write to public directory
  const outputPath = path.join(__dirname, '../public/version.json');
  fs.writeFileSync(outputPath, JSON.stringify(version, null, 2));

  console.log('✅ Version file generated:', version);
} catch (error) {
  console.warn('⚠️  Could not generate version file:', error.message);

  // Create a fallback version
  const fallbackVersion = {
    commit: 'unknown',
    date: new Date().toISOString(),
    branch: 'unknown',
    buildTime: new Date().toISOString(),
  };

  const outputPath = path.join(__dirname, '../public/version.json');
  fs.writeFileSync(outputPath, JSON.stringify(fallbackVersion, null, 2));
}
