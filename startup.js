const { execSync } = require('child_process');

console.log('🔄 Running Prisma schema sync (db push)...');

try {
  execSync('npx prisma db push', {
    stdio: 'inherit',
    shell: true,
  });
  console.log('✅ Prisma schema synced successfully.');
} catch (error) {
  console.error('❌ Prisma db push failed. Check the error above.');
  process.exit(1);
}

console.log('🚀 Starting Next.js server...');
const { spawn } = require('child_process');
const server = spawn('npx', ['next', 'start'], {
  stdio: 'inherit',
  shell: true,
});

server.on('close', (code) => {
  process.exit(code);
});
