import { ensureSession } from '../session.js';
import { queryActivities, queryMyActivities, joinActivity, cancelActivity, getSignInInfo, signIn, signBack } from '../../../src/lib/club.js';

export async function GET(request) {
  try {
    const session = await ensureSession();
    if (!session) return Response.json({ error: '未登录' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const date = searchParams.get('date') || undefined;

    if (action === 'list') {
      const acts = await queryActivities(date);
      return Response.json(acts || []);
    } else if (action === 'mine') {
      const mine = await queryMyActivities();
      return Response.json(mine || []);
    } else if (action === 'signinfo') {
      const info = await getSignInInfo();
      return Response.json(info);
    }
    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await ensureSession();
    if (!session) return Response.json({ error: '未登录' }, { status: 401 });

    const { action, activityId } = await request.json();

    if (action === 'join') {
      const result = await joinActivity(activityId);
      return Response.json({ success: true, result });
    } else if (action === 'cancel') {
      const result = await cancelActivity(activityId);
      return Response.json({ success: true, result });
    } else if (action === 'signIn') {
      const info = await getSignInInfo();
      if (!info || !info.activityId) {
        return Response.json({ success: true, result: { success: false, reason: 'no_activity' } });
      }
      if (info.signStatus !== '1') {
        return Response.json({ success: true, result: { success: false, reason: 'wrong_status', message: `当前状态不需要签到（状态=${info.signStatus === '2' ? '待签退' : '已完成'}）` } });
      }
      const result = await signIn(info.activityId, info.latitude, info.longitude);
      return Response.json({ success: true, result: { success: true, type: 'sign_in', activityName: info.activityName, result } });
    } else if (action === 'signBack') {
      const info = await getSignInInfo();
      if (!info || !info.activityId) {
        return Response.json({ success: true, result: { success: false, reason: 'no_activity' } });
      }
      if (info.signStatus !== '2') {
        return Response.json({ success: true, result: { success: false, reason: 'wrong_status', message: `当前状态不需要签退（状态=${info.signStatus === '1' ? '待签到' : '已完成'}）` } });
      }
      const result = await signBack(info.activityId, info.latitude, info.longitude);
      return Response.json({ success: true, result: { success: true, type: 'sign_back', activityName: info.activityName, result } });
    }
    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
