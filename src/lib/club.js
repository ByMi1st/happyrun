import client from './client.js';
import { getSession } from './auth.js';
import { formatDate } from '../utils/date.js';
import { jitterCoordinate } from './anti-detection.js';

export async function getMyClubProjects() {
  const { studentId, schoolId } = getSession();
  return client.get('v1/clubactivity/getMyClubItemList', {
    params: { studentId, schoolId },
  });
}

export async function queryActivities(date, activityItemId, pageNo = 1) {
  const { studentId, schoolId } = getSession();
  const params = { queryTime: date || formatDate(), studentId, schoolId, pageNo, pageSize: 15 };
  if (activityItemId) params.activityItemId = activityItemId;
  return client.get('v1/clubactivity/queryActivityList', { params });
}

export async function queryMyActivities(pageNo = 1) {
  const { studentId } = getSession();
  return client.get('v1/clubactivity/queryMyActivityList', {
    params: { studentId, pageNo, pageSize: 15 },
  });
}

export async function joinActivity(activityId) {
  const { studentId } = getSession();
  return client.get('v1/clubactivity/joinClubActivity', {
    params: { studentId, activityId },
  });
}

export async function cancelActivity(activityId) {
  const { studentId } = getSession();
  return client.get('v1/clubactivity/cancelActivity', {
    params: { studentId, activityId },
  });
}

export async function getSignInInfo() {
  const { studentId } = getSession();
  return client.get('v1/clubactivity/getSignInTf', {
    params: { studentId },
  });
}

export async function signIn(activityId, latitude, longitude) {
  const { studentId } = getSession();
  const jittered = jitterCoordinate(Number(latitude), Number(longitude), 15);
  return client.post('v1/clubactivity/signInOrSignBack', {
    activityId,
    latitude: String(jittered.lat),
    longitude: String(jittered.lng),
    signType: '1',
    studentId,
  });
}

export async function signBack(activityId, latitude, longitude) {
  const { studentId } = getSession();
  const jittered = jitterCoordinate(Number(latitude), Number(longitude), 15);
  return client.post('v1/clubactivity/signInOrSignBack', {
    activityId,
    latitude: String(jittered.lat),
    longitude: String(jittered.lng),
    signType: '2',
    studentId,
  });
}

export async function autoSignIn() {
  const info = await getSignInInfo();

  if (!info || !info.activityId) {
    return { success: false, reason: 'no_activity', info };
  }

  const { activityId, signStatus, latitude, longitude, activityName } = info;

  if (signStatus === '1') {
    const result = await signIn(activityId, latitude, longitude);
    return { success: true, type: 'sign_in', activityName, activityId, result };
  } else if (signStatus === '2') {
    const result = await signBack(activityId, latitude, longitude);
    return { success: true, type: 'sign_back', activityName, activityId, result };
  } else {
    return { success: false, reason: 'already_done', activityName, info };
  }
}
