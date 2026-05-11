import { ensureAccounts } from '../session.js';
import { getAccount } from '../../../src/lib/account-manager.js';
import { scheduleForActivity, getScheduledTasks, cancelScheduledTask } from '../../../src/lib/schedule.js';

export async function GET(request) {
  try {
    await ensureAccounts();
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    return Response.json(getScheduledTasks(phone || undefined));
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureAccounts();
    const { phone, activity } = await request.json();
    const account = getAccount(phone);
    if (!account) return Response.json({ error: '未登录或缺少phone参数' }, { status: 401 });
    if (!activity || !activity.clubActivityId) {
      return Response.json({ error: '缺少活动信息' }, { status: 400 });
    }
    const result = scheduleForActivity(account, activity);
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
    const id = searchParams.get('id');
    if (!phone || !id) return Response.json({ error: '缺少phone或id' }, { status: 400 });
    cancelScheduledTask(phone, id);
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
