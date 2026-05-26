// Script tạo tài khoản admin (chạy trong Docker)
// Usage: docker exec -it managerbill_backend node prisma/create-admin.js

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const username = 'lamanh';
  const password = 'Tinhkhiet1995@';
  const displayName = 'Lâm Anh';

  const hashedPassword = await bcrypt.hash(password, 12);

  try {
    const existingUser = await prisma.user.findUnique({
      where: { username }
    });

    if (existingUser) {
      await prisma.user.update({
        where: { username },
        data: { passwordHash: hashedPassword }
      });
      console.log('Da cap nhat password cho user: ' + username);
    } else {
      await prisma.user.create({
        data: {
          username,
          passwordHash: hashedPassword,
          displayName
        }
      });
      console.log('Da tao tai khoan thanh cong!');
    }

    console.log('\nThong tin dang nhap:');
    console.log('Username:', username);
    console.log('Password:', password);
  } catch (error) {
    console.error('Loi:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
