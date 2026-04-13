import { createAuthClient } from 'better-auth/client';

function getBaseURL() {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/auth`;
  }
  return 'http://localhost:5187/api/auth';
}

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
});
