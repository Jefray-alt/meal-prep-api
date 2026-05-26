import type { TypedRequest } from './typed-request';

export type AuthenticatedRequest = TypedRequest & {
  user: { email: string; sub: string };
};
