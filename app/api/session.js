import { loginAccountByToken, getAccount, getAllAccounts } from '../../src/lib/account-manager.js';
import { cookies } from 'next/headers';

export async function ensureAccounts() {
  const cookieStore = await cookies();
  const raw = cookieStore.get('happyrun_accounts')?.value;
  if (!raw) return getAllAccounts();

  try {
    const list = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    for (const { phone, token } of list) {
      if (!getAccount(phone)) {
        try { await loginAccountByToken(phone, token); } catch {}
      }
    }
  } catch {}

  return getAllAccounts();
}

export function getAccountFromRequest(searchParams, body) {
  const phone = searchParams?.get?.('phone') || body?.phone;
  if (!phone) return null;
  return getAccount(phone);
}

export async function setAccountsCookie(cookieStore) {
  const all = getAllAccounts();
  const list = [];
  for (const a of all) {
    const full = getAccount(a.phone);
    if (full) list.push({ phone: a.phone, token: full.token });
  }
  const encoded = Buffer.from(JSON.stringify(list)).toString('base64');
  cookieStore.set('happyrun_accounts', encoded, {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 86400,
  });
}
