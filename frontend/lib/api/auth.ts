import { api, authStorage } from './client';
import type { UserProfile, Enrollment } from '@/types/domain.types';

interface AuthSession {
  session: { access_token: string; refresh_token: string; expires_at?: number } | null;
  user: { id: string; email?: string } | null;
  needsConfirmation?: boolean;
}

export const authApi = {
  async register(input: { email: string; password: string; confirmPassword: string; fullName: string }) {
    const res = await api.post<{ success: true; data: AuthSession }>('/auth/register', input);
    if (res.data.session) authStorage.setSession(res.data.session);
    return res.data;
  },

  async login(input: { email: string; password: string }) {
    const res = await api.post<{ success: true; data: AuthSession }>('/auth/login', input);
    if (res.data.session) authStorage.setSession(res.data.session);
    return res.data;
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      authStorage.clear();
    }
  },

  forgotPassword(email: string, redirectTo?: string) {
    return api.post<{ success: true }>('/auth/forgot-password', { email, redirectTo });
  },

  me() {
    return api.get<{ success: true; data: { user: UserProfile; enrollments: Enrollment[] } }>('/auth/me');
  },
};
