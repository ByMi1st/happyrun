import { parseSiteBound } from './geo.js';
import { generateTrack } from './track-generator.js';
import { loadTemplate, generateFromTemplate } from './track-template.js';
import { formatDate } from '../utils/date.js';
import { isInSafeRunWindow, calculateSafePace, scoreTrack, getAntiDetectionAdvice } from './anti-detection.js';

export async function getRunStandard(client, schoolId) {
  return client.get('v1/unirun/query/runStandard', { params: { schoolId } });
}

export async function getSchoolBound(client, schoolId) {
  return client.get('v1/unirun/querySchoolBound', { params: { schoolId } });
}

export async function getVocalStatus(client, userId) {
  return client.get('v1/unirun/query/user/vocalStatus', { params: { userId } });
}

export async function submitRunRecord(client, body) {
  return client.post('v1/unirun/save/run/record/new', body);
}

export async function executeCampusRun(account, { routeName = null, distance = null, time = null } = {}) {
  const { schoolId, userId, gender, device, client } = account;

  const standard = await getRunStandard(client, schoolId);
  const bounds = await getSchoolBound(client, schoolId);
  if (!bounds || bounds.length === 0) throw new Error('No school bounds configured');

  const polygon = parseSiteBound(bounds[0].siteBound);
  if (polygon.length < 3) throw new Error('Invalid school polygon');

  const vocal = await getVocalStatus(client, userId);
  let vocalStatus = '0';
  if (vocal.openStatus === '1') {
    vocalStatus = vocal.vocalStatus === '1' ? '1' : '0';
  } else {
    vocalStatus = '1';
  }

  const isMale = gender === '1';
  const distMin = isMale ? standard.boyOnceDistanceMin : standard.girlOnceDistanceMin;
  const distMax = isMale ? standard.boyOnceDistanceMax : standard.girlOnceDistanceMax;
  const timeMin = isMale ? standard.boyOnceTimeMin : standard.girlOnceTimeMin;
  const timeMax = isMale ? standard.boyOnceTimeMax : standard.girlOnceTimeMax;

  let targetDist = distance || (distMin + Math.floor(Math.random() * (distMax - distMin) * 0.4));
  let targetTime = time || (timeMin + Math.floor(Math.random() * (timeMax - timeMin) * 0.5));

  targetDist = Math.max(distMin, Math.min(distMax, targetDist));
  targetTime = Math.max(timeMin, Math.min(timeMax, targetTime));

  let track;
  if (routeName) {
    const template = loadTemplate(routeName);
    if (template) {
      track = generateFromTemplate(template, targetDist, targetTime);
    }
  }
  if (!track) {
    track = generateTrack(polygon, targetDist, targetTime);
  }

  const quality = scoreTrack(track.trackPoints);
  const pace = calculateSafePace(track.runDistance, track.runTime);
  const warnings = getAntiDetectionAdvice({ distance: track.runDistance, time: track.runTime });

  const body = {
    againRunStatus: '0',
    againRunTime: 0,
    appVersions: device.appVersions,
    brand: device.brand,
    mobileType: device.mobileType,
    sysVersions: device.sysVersions,
    trackPoints: JSON.stringify(track.trackPoints),
    distanceTimeStatus: '1',
    innerSchool: '1',
    runDistance: track.runDistance,
    runTime: track.runTime,
    userId,
    vocalStatus,
    yearSemester: standard.semesterYear,
    recordDate: formatDate(),
    realityTrackPoints: bounds.map((b) => b.siteBound).join('--'),
  };

  const result = await submitRunRecord(client, body);
  return {
    ...result,
    runDistance: track.runDistance,
    runTime: track.runTime,
    pointCount: track.pointCount,
    quality,
    pace,
    warnings,
  };
}

export function getRunLimits(standard, gender) {
  const isMale = gender === '1';
  return {
    distMin: isMale ? standard.boyOnceDistanceMin : standard.girlOnceDistanceMin,
    distMax: isMale ? standard.boyOnceDistanceMax : standard.girlOnceDistanceMax,
    timeMin: isMale ? standard.boyOnceTimeMin : standard.girlOnceTimeMin,
    timeMax: isMale ? standard.boyOnceTimeMax : standard.girlOnceTimeMax,
  };
}
