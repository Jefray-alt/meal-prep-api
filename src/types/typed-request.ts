import type { Request } from 'express';

export interface AppCookies {
  refresh_token?: string;
}

export type TypedRequest = Omit<Request, 'cookies'> & { cookies: AppCookies };
