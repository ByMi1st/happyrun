import { loginAccount, getAllAccounts, getAccount, removeAccount } from '../../../src/lib/account-manager.js';
import { ensureAccounts, setAccountsCookie } from '../session.js';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const accounts = await ensureAccounts();
    return Response.json(accounts);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { phone, password } = await request.json();
    if (!phone || !password) {
      return Response.json({ error: '请输入手机号和密码' }, { status: 400 });
    }
    const account = await loginAccount(phone, password);
    const cookieStore = await cookies();
    await setAccountsCookie(cookieStore);
    return Response.json({
      phone: account.phone,
      studentName: account.studentName,
      schoolName: account.schoolName,
      gender: account.gender,
      loginAt: account.loginAt,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 401 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    if (!phone) return Response.json({ error: '缺少手机号' }, { status: 400 });
    removeAccount(phone);
    const cookieStore = await cookies();
    await setAccountsCookie(cookieStore);
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
