export const REFRESH_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  path: '/api/auth/refresh',
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
};
