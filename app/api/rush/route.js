import { ensureAccounts } from '../session.js';
import { getAccount } from '../../../src/lib/account-manager.js';
import { scheduleRush, getAllRushStatus, cancelRush } from '../../../src/lib/rush.js';

export async function GET(request) {
  try {
    await ensureAccounts();
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    return Response.json(getAllRushStatus(phone || undefined));
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureAccounts();
    const { phone, activityId, activityName, delayMs } = await request.json();
    const account = getAccount(phone);
    if (!account) return Response.json({ error: '未登录或缺少phone参数' }, { status: 401 });
    if (!activityId) return Response.json({ error: '缺少活动ID' }, { status: 400 });

    const delay = Math.max(0, delayMs || 0);
    const result = scheduleRush(account, activityId, activityName || '', delay);
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    await ensureAccounts();
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    const activityId = searchParams.get('activityId');
    if (!phone || !activityId) return Response.json({ error: '缺少phone或activityId' }, { status: 400 });
    cancelRush(phone, Number(activityId));
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
