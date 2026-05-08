import {
  randomPointInPolygon,
  pointInPolygon,
  movePoint,
  haversineDistance,
} from './geo.js';

const DISTANCE_FACTOR = 1.3;

export function generateTrack(polygon, targetDistanceMeters, targetTimeMinutes) {
  const rawDistance = targetDistanceMeters / DISTANCE_FACTOR;
  const totalSeconds = targetTimeMinutes * 60;
  const avgSpeed = rawDistance / totalSeconds;

  const points = [];
  let currentPoint = randomPointInPolygon(polygon);
  let bearing = Math.random() * 360;
  let accumulatedDistance = 0;
  let currentSpeed = avgSpeed;

  const buffer = 60 + Math.floor(Math.random() * 120);
  const startTime = Date.now() - (totalSeconds + buffer) * 1000;
  let elapsed = 0;

  let jitterLng = 0;
  let jitterLat = 0;

  const pauseCount = 1 + Math.floor(Math.random() * 3);
  const pauseAtSeconds = [];
  for (let i = 0; i < pauseCount; i++) {
    pauseAtSeconds.push(Math.floor(totalSeconds * 0.2 + Math.random() * totalSeconds * 0.6));
  }
  pauseAtSeconds.sort((a, b) => a - b);
  let nextPauseIdx = 0;

  while (accumulatedDistance < rawDistance && elapsed < totalSeconds) {
    if (nextPauseIdx < pauseAtSeconds.length && elapsed >= pauseAtSeconds[nextPauseIdx]) {
      const pauseDuration = 5 + Math.floor(Math.random() * 10);
      for (let p = 0; p < pauseDuration; p += 3) {
        jitterLng = jitterLng * 0.6 + (Math.random() - 0.5) * 0.00001 * 0.4;
        jitterLat = jitterLat * 0.6 + (Math.random() - 0.5) * 0.00001 * 0.4;
        points.push({
          lng: (currentPoint.lng + jitterLng).toFixed(7),
          lat: (currentPoint.lat + jitterLat).toFixed(7),
          time: startTime + (elapsed + p) * 1000,
          accuracy: Math.floor(Math.random() * 10) + 5,
        });
      }
      elapsed += pauseDuration;
      nextPauseIdx++;
      continue;
    }

    jitterLng = jitterLng * 0.7 + (Math.random() - 0.5) * 0.00002 * 0.3;
    jitterLat = jitterLat * 0.7 + (Math.random() - 0.5) * 0.00002 * 0.3;

    const accuracy = Math.floor(Math.random() * 12) + 5;
    const timestamp = startTime + elapsed * 1000;

    points.push({
      lng: (currentPoint.lng + jitterLng).toFixed(7),
      lat: (currentPoint.lat + jitterLat).toFixed(7),
      time: timestamp,
      accuracy,
    });

    const targetSpeed = avgSpeed * (0.85 + Math.random() * 0.3);
    currentSpeed += (targetSpeed - currentSpeed) * 0.3;

    const interval = 3 + Math.random() * 3;
    const stepDistance = currentSpeed * interval;

    bearing += (Math.random() - 0.5) * 30;
    if (bearing < 0) bearing += 360;
    if (bearing >= 360) bearing -= 360;

    let nextPoint = movePoint(currentPoint, bearing, stepDistance);

    let attempts = 0;
    while (!pointInPolygon(nextPoint, polygon) && attempts < 6) {
      bearing = (bearing + 150 + Math.random() * 60) % 360;
      nextPoint = movePoint(currentPoint, bearing, stepDistance * 0.7);
      attempts++;
    }

    if (!pointInPolygon(nextPoint, polygon)) {
      bearing = (bearing + 180) % 360;
      nextPoint = movePoint(currentPoint, bearing, stepDistance * 0.5);
      if (!pointInPolygon(nextPoint, polygon)) {
        nextPoint = randomPointInPolygon(polygon);
      }
    }

    accumulatedDistance += haversineDistance(currentPoint, nextPoint);
    currentPoint = nextPoint;
    elapsed += interval;
  }

  points.push({
    lng: (currentPoint.lng + jitterLng * 0.5).toFixed(7),
    lat: (currentPoint.lat + jitterLat * 0.5).toFixed(7),
    time: startTime + Math.floor(elapsed) * 1000,
    accuracy: Math.floor(Math.random() * 10) + 6,
  });

  const trackStrings = points.map(
    (p) => `${p.lng}-${p.lat}-${p.time}-${p.accuracy}`
  );

  const reportedDistance = Math.round(accumulatedDistance * DISTANCE_FACTOR);

  return {
    trackPoints: trackStrings,
    runDistance: reportedDistance,
    runTime: targetTimeMinutes,
    pointCount: points.length,
  };
}
