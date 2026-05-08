import { loginByToken, getSession } from '../../src/lib/auth.js';
import { cookies } from 'next/headers';

export async function ensureSession() {
  if (getSession()) return getSession();

  const cookieStore = await cookies();
  const token = cookieStore.get('happyrun_token')?.value;
  if (!token) return null;

  try {
    return await loginByToken(token);
  } catch {
    return null;
  }
}
