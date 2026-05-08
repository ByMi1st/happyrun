const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const EARTH_RADIUS = 6371000;

export function parseSiteBound(str) {
  return str.split(',').filter(Boolean).map((pair) => {
    const parts = pair.split('-').map(Number);
    return { lng: parts[0], lat: parts[1] };
  });
}

export function pointInPolygon(point, polygon) {
  let inside = false;
  const { lng: x, lat: y } = point;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function haversineDistance(p1, p2) {
  const dLat = (p2.lat - p1.lat) * DEG_TO_RAD;
  const dLng = (p2.lng - p1.lng) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(p1.lat * DEG_TO_RAD) * Math.cos(p2.lat * DEG_TO_RAD) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function movePoint(point, bearingDeg, distanceMeters) {
  const bearing = bearingDeg * DEG_TO_RAD;
  const lat1 = point.lat * DEG_TO_RAD;
  const lng1 = point.lng * DEG_TO_RAD;
  const angDist = distanceMeters / EARTH_RADIUS;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angDist) + Math.cos(lat1) * Math.sin(angDist) * Math.cos(bearing)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angDist) * Math.cos(lat1),
      Math.cos(angDist) - Math.sin(lat1) * Math.sin(lat2)
    );

  return { lng: lng2 * RAD_TO_DEG, lat: lat2 * RAD_TO_DEG };
}

export function randomPointInPolygon(polygon) {
  const bbox = getBoundingBox(polygon);
  for (let i = 0; i < 1000; i++) {
    const point = {
      lng: bbox.minLng + Math.random() * (bbox.maxLng - bbox.minLng),
      lat: bbox.minLat + Math.random() * (bbox.maxLat - bbox.minLat),
    };
    if (pointInPolygon(point, polygon)) return point;
  }
  return polygonCentroid(polygon);
}

export function polygonCentroid(polygon) {
  let sumLng = 0, sumLat = 0;
  for (const p of polygon) {
    sumLng += p.lng;
    sumLat += p.lat;
  }
  return { lng: sumLng / polygon.length, lat: sumLat / polygon.length };
}

function getBoundingBox(polygon) {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const p of polygon) {
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
  }
  return { minLng, maxLng, minLat, maxLat };
}
