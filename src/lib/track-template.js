import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { haversineDistance } from './geo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUTES_DIR = path.join(__dirname, '../../data/routes');

function ensureDir() {
  if (!fs.existsSync(ROUTES_DIR)) fs.mkdirSync(ROUTES_DIR, { recursive: true });
}

export function listTemplates() {
  ensureDir();
  return fs.readdirSync(ROUTES_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(ROUTES_DIR, f), 'utf-8'));
        return { name: data.name || f.replace('.json', ''), file: f, pointCount: data.points?.length || 0 };
      } catch { return null; }
    })
    .filter(Boolean);
}

export function loadTemplate(name) {
  const filePath = path.join(ROUTES_DIR, `${name}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function saveTemplate(name, points) {
  ensureDir();
  const data = { name, points, createdAt: new Date().toISOString() };
  fs.writeFileSync(path.join(ROUTES_DIR, `${name}.json`), JSON.stringify(data, null, 2));
  return data;
}

export function deleteTemplate(name) {
  const filePath = path.join(ROUTES_DIR, `${name}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

export function generateFromTemplate(template, targetDistanceMeters, targetTimeMinutes) {
  const points = template.points;
  if (!points || points.length < 2) throw new Error('Route template has too few points');

  const totalSeconds = targetTimeMinutes * 60;
  const buffer = 60 + Math.floor(Math.random() * 120);
  const startTime = Date.now() - (totalSeconds + buffer) * 1000;

  let templateDist = 0;
  for (let i = 1; i < points.length; i++) {
    templateDist += haversineDistance(points[i - 1], points[i]);
  }

  const loops = Math.max(1, Math.ceil((targetDistanceMeters / 1.3) / templateDist));
  let fullRoute = [...points];
  for (let l = 1; l < loops; l++) {
    const offset = { lng: (Math.random() - 0.5) * 0.0001, lat: (Math.random() - 0.5) * 0.0001 };
    fullRoute = fullRoute.concat(points.map(p => ({ lng: p.lng + offset.lng, lat: p.lat + offset.lat })));
  }

  const rawTarget = targetDistanceMeters / 1.3;
  const avgSpeed = rawTarget / totalSeconds;
  const result = [];
  let elapsed = 0;
  let accDist = 0;
  let jLng = 0, jLat = 0;
  let routeIdx = 0;

  const pauseAt = totalSeconds * (0.3 + Math.random() * 0.4);
  let paused = false;

  while (accDist < rawTarget && elapsed < totalSeconds && routeIdx < fullRoute.length) {
    const pt = fullRoute[routeIdx];

    jLng = jLng * 0.7 + (Math.random() - 0.5) * 0.00003 * 0.3;
    jLat = jLat * 0.7 + (Math.random() - 0.5) * 0.00003 * 0.3;

    result.push({
      lng: (pt.lng + jLng).toFixed(7),
      lat: (pt.lat + jLat).toFixed(7),
      time: startTime + Math.floor(elapsed) * 1000,
      accuracy: Math.floor(Math.random() * 10) + 5,
    });

    if (!paused && elapsed >= pauseAt) {
      const pauseDur = 5 + Math.floor(Math.random() * 10);
      elapsed += pauseDur;
      paused = true;
    }

    if (routeIdx < fullRoute.length - 1) {
      const segDist = haversineDistance(fullRoute[routeIdx], fullRoute[routeIdx + 1]);
      accDist += segDist;
      const segTime = segDist / (avgSpeed * (0.85 + Math.random() * 0.3));
      elapsed += segTime;
    }
    routeIdx++;
  }

  const trackStrings = result.map(p => `${p.lng}-${p.lat}-${p.time}-${p.accuracy}`);
  const reportedDistance = Math.round(accDist * 1.3);

  return {
    trackPoints: trackStrings,
    runDistance: reportedDistance,
    runTime: targetTimeMinutes,
    pointCount: result.length,
  };
}
