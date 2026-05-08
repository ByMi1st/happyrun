import { login, loginByToken, getSession } from '../../../src/lib/auth.js';

export async function POST(request) {
  try {
    const { phone, password } = await request.json();
    if (!phone || !password) {
      return Response.json({ error: '请输入手机号和密码' }, { status: 400 });
    }
    const session = await login(phone, password);
    const res = Response.json(session);
    res.headers.set('Set-Cookie', `happyrun_token=${session.token};Path=/;HttpOnly;SameSite=Strict;Max-Age=86400`);
    return res;
  } catch (e) {
    return Response.json({ error: e.message }, { status: 401 });
  }
}
