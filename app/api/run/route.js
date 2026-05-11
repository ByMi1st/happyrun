import { ensureAccounts, getAccountFromRequest } from '../session.js';
import { getAccount } from '../../../src/lib/account-manager.js';
import { executeCampusRun, getRunStandard, getRunLimits } from '../../../src/lib/run.js';

export async function GET(request) {
  try {
    await ensureAccounts();
    const { searchParams } = new URL(request.url);
    const account = getAccountFromRequest(searchParams);
    if (!account) return Response.json({ error: '未登录或缺少phone参数' }, { status: 401 });
    const standard = await getRunStandard(account.client, account.schoolId);
    const limits = getRunLimits(standard, account.gender);
    return Response.json({ standard, limits });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureAccounts();
    const body = await request.json().catch(() => ({}));
    const account = getAccount(body.phone);
    if (!account) return Response.json({ error: '未登录或缺少phone参数' }, { status: 401 });
    const result = await executeCampusRun(account, {
      routeName: body.routeName || null,
      distance: body.distance || null,
      time: body.time || null,
    });
    return Response.json({ success: true, result });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
