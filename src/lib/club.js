import { formatDate } from '../utils/date.js';
import { jitterCoordinate } from './anti-detection.js';

export async function getMyClubProjects(account) {
  const { studentId, schoolId, client } = account;
  return client.get('v1/clubactivity/getMyClubItemList', {
    params: { studentId, schoolId },
  });
}

export async function queryActivities(account, date, activityItemId, pageNo = 1) {
  const { studentId, schoolId, client } = account;
  const params = { queryTime: date || formatDate(), studentId, schoolId, pageNo, pageSize: 15 };
  if (activityItemId) params.activityItemId = activityItemId;
  return client.get('v1/clubactivity/queryActivityList', { params });
}

export async function queryMyActivities(account, pageNo = 1) {
  const { studentId, client } = account;
  return client.get('v1/clubactivity/queryMyActivityList', {
    params: { studentId, pageNo, pageSize: 15 },
  });
}

export async function joinActivity(account, activityId) {
  const { studentId, client } = account;
  return client.get('v1/clubactivity/joinClubActivity', {
    params: { studentId, activityId },
  });
}

export async function cancelActivity(account, activityId) {
  const { studentId, client } = account;
  return client.get('v1/clubactivity/cancelActivity', {
    params: { studentId, activityId },
  });
}

export async function getSignInInfo(account) {
  const { studentId, client } = account;
  return client.get('v1/clubactivity/getSignInTf', {
    params: { studentId },
  });
}

export async function signIn(account, activityId, latitude, longitude) {
  const { studentId, client } = account;
  const jittered = jitterCoordinate(Number(latitude), Number(longitude), 15);
  return client.post('v1/clubactivity/signInOrSignBack', {
    activityId,
    latitude: String(jittered.lat),
    longitude: String(jittered.lng),
    signType: '1',
    studentId,
  });
}

export async function signBack(account, activityId, latitude, longitude) {
  const { studentId, client } = account;
  const jittered = jitterCoordinate(Number(latitude), Number(longitude), 15);
  return client.post('v1/clubactivity/signInOrSignBack', {
    activityId,
    latitude: String(jittered.lat),
    longitude: String(jittered.lng),
    signType: '2',
    studentId,
  });
}

export async function autoSignIn(account) {
  const info = await getSignInInfo(account);

  if (!info || !info.activityId) {
    return { success: false, reason: 'no_activity', info };
  }

  const { activityId, signStatus, latitude, longitude, activityName } = info;

  if (signStatus === '1') {
    const result = await signIn(account, activityId, latitude, longitude);
    return { success: true, type: 'sign_in', activityName, activityId, result };
  } else if (signStatus === '2') {
    const result = await signBack(account, activityId, latitude, longitude);
    return { success: true, type: 'sign_back', activityName, activityId, result };
  } else {
    return { success: false, reason: 'already_done', activityName, info };
  }
}
