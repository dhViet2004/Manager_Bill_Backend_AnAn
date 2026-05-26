// Shared CORS headers for API routes
const ALLOWED_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:3001';

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

export function corsOptionsResponse() {
  return new Response(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}
