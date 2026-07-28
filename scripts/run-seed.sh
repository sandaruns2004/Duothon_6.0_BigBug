#!/bin/sh
apk add nodejs npm git
rm -rf /tmp/repo
git clone https://github.com/sandaruns2004/Duothon_6.0_BigBug.git /tmp/repo
cd /tmp/repo
npm install bcrypt prisma @prisma/client
node scripts/seed-demo.js
