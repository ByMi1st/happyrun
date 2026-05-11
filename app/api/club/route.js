import { ensureAccounts, getAccountFromRequest } from '../session.js';
import { getAccount, getAllAccounts } from '../../../src/lib/account-manager.js';
import { queryActivities, queryMyActivities, joinActivity, cancelActivity, getSignInInfo, signIn, signBack, autoSignIn } from '../../../src/lib/club.js';

export async function GET(request) {
  try {
    await ensureAccounts();
    const { searchParams } = new URL(request.url);
    const account = getAccountFromRequest(searchParams);
    if (!account) return Response.json({ error: '未登录或缺少phone参数' }, { status: 401 });

    const action = searchParams.get('action');
    const date = searchParams.get('date') || undefined;

    if (action === 'list') {
      const acts = await queryActivities(account, date);
      return Response.json(acts || []);
    } else if (action === 'mine') {
      const mine = await queryMyActivities(account);
      return Response.json(mine || []);
    } else if (action === 'signinfo') {
      const info = await getSignInInfo(account);
      return Response.json(info);
    }
    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureAccounts();
    const body = await request.json();
    const { action, activityId, phone } = body;

    if (action === 'signInAll') {
      const all = getAllAccounts();
      const results = await Promise.allSettled(
        all.map(a => {
          const acc = getAccount(a.phone);
          return acc ? autoSignIn(acc) : Promise.resolve({ success: false, reason: 'not_found' });
        })
      );
      return Response.json({
        results: results.map((r, i) => ({
          phone: all[i].phone,
          studentName: all[i].studentName,
          ...(r.status === 'fulfilled' ? r.value : { success: false, reason: 'error', error: r.reason?.message }),
        })),
      });
    }

    if (action === 'signBackAll') {
      const all = getAllAccounts();
      const results = await Promise.allSettled(
        all.map(async a => {
          const acc = getAccount(a.phone);
          if (!acc) return { success: false, reason: 'not_found' };
          const info = await getSignInInfo(acc);
          if (!info?.activityId || info.signStatus !== '2') return { success: false, reason: 'no_need' };
          await signBack(acc, info.activityId, info.latitude, info.longitude);
          return { success: true, type: 'sign_back', activityName: info.activityName };
        })
      );
      return Response.json({
        results: results.map((r, i) => ({
          phone: all[i].phone,
          studentName: all[i].studentName,
          ...(r.status === 'fulfilled' ? r.value : { success: false, reason: 'error', error: r.reason?.message }),
        })),
      });
    }

    const account = getAccount(phone);
    if (!account) return Response.json({ error: '未登录或缺少phone参数' }, { status: 401 });

    if (action === 'join') {
      const result = await joinActivity(account, activityId);
      return Response.json({ success: true, result });
    } else if (action === 'cancel') {
      const result = await cancelActivity(account, activityId);
      return Response.json({ success: true, result });
    } else if (action === 'signIn') {
      const info = await getSignInInfo(account);
      if (!info || !info.activityId) {
        return Response.json({ success: true, result: { success: false, reason: 'no_activity' } });
      }
      if (info.signStatus !== '1') {
        return Response.json({ success: true, result: { success: false, reason: 'wrong_status', message: `当前状态不需要签到（状态=${info.signStatus === '2' ? '待签退' : '已完成'}）` } });
      }
      const result = await signIn(account, info.activityId, info.latitude, info.longitude);
      return Response.json({ success: true, result: { success: true, type: 'sign_in', activityName: info.activityName, result } });
    } else if (action === 'signBack') {
      const info = await getSignInInfo(account);
      if (!info || !info.activityId) {
        return Response.json({ success: true, result: { success: false, reason: 'no_activity' } });
      }
      if (info.signStatus !== '2') {
        return Response.json({ success: true, result: { success: false, reason: 'wrong_status', message: `当前状态不需要签退（状态=${info.signStatus === '1' ? '待签到' : '已完成'}）` } });
      }
      const result = await signBack(account, info.activityId, info.latitude, info.longitude);
      return Response.json({ success: true, result: { success: true, type: 'sign_back', activityName: info.activityName, result } });
    }
    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
