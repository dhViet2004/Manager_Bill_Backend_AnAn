import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';
import { LoginSchema } from '@/lib/validators';
import { createToken, setTokenCookie } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/response';
import { corsOptionsResponse } from '@/lib/cors';

export async function OPTIONS() {
  return corsOptionsResponse();
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    
    // Validate input
    const result = LoginSchema.safeParse(body);
    if (!result.success) {
      return errorResponse(result.error.errors[0].message, 400);
    }

    const { username, password } = result.data;

    // Find user
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return errorResponse('Invalid credentials', 401);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return errorResponse('Invalid credentials', 401);
    }

    // Create token
    const token = await createToken({
      id: user.id,
      username: user.username,
      displayName: user.displayName || undefined,
      photoURL: user.photoUrl || undefined,
    });

    // Set cookie
    await setTokenCookie(token);

    // Return response
    return successResponse({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        photoURL: user.photoUrl,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    return errorResponse('Internal server error', 500);
  }
}
