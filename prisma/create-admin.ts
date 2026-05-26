// Script tạo tài khoản admin
// Chạy: cd backend && npx ts-node prisma/create-admin.ts

import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const username = 'lamanh';
  const password = 'Tinhkhiet1995@';
  const displayName = 'Lâm Anh';

  // Kiểm tra user đã tồn tại
  const existingUser = await prisma.user.findUnique({
    where: { username }
  });

  if (existingUser) {
    console.log('User đã tồn tại, cập nhật password...');
    const hashedPassword = await hash(password, 12);
    await prisma.user.update({
      where: { username },
      data: { passwordHash: hashedPassword }
    });
    console.log('Đã cập nhật password!');
  } else {
    console.log('Tạo user mới...');
    const hashedPassword = await hash(password, 12);
    await prisma.user.create({
      data: {
        username,
        passwordHash: hashedPassword,
        displayName
      }
    });
    console.log('Đã tạo tài khoản thành công!');
  }

  console.log('\nThông tin đăng nhập:');
  console.log('Username:', username);
  console.log('Password:', password);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());