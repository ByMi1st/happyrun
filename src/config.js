export const BASE_URL = 'https://run-lb.tanmasports.com/';
export const APPKEY = process.env.APPKEY || '389885588s0648fa';
export const APPSECRET = process.env.APPSECRET || '56E39A1658455588885690425C0FD16055A21676';

const BRANDS = [
  { brand: 'Xiaomi', models: ['Redmi K30', 'Redmi Note 11', 'Mi 12', 'Redmi K50', 'Redmi Note 12', 'Mi 13'] },
  { brand: 'HUAWEI', models: ['P40', 'Mate 30', 'Nova 8', 'Honor 50', 'P50', 'Mate 40'] },
  { brand: 'OPPO', models: ['Reno6', 'Find X3', 'A96', 'K9', 'Reno8', 'Find X5'] },
  { brand: 'vivo', models: ['X70', 'S12', 'Y76s', 'iQOO 9', 'X80', 'S15'] },
  { brand: 'samsung', models: ['Galaxy S21', 'Galaxy A52', 'Galaxy Note20', 'Galaxy S22', 'Galaxy A53'] },
];
const VERSIONS = ['10', '11', '12', '13', '14'];
const APP_VERSIONS = ['1.8.0', '1.8.2', '1.8.5', '1.9.0'];

export function randomDevice() {
  const brandGroup = BRANDS[Math.floor(Math.random() * BRANDS.length)];
  const model = brandGroup.models[Math.floor(Math.random() * brandGroup.models.length)];
  return {
    appVersions: APP_VERSIONS[Math.floor(Math.random() * APP_VERSIONS.length)],
    brand: brandGroup.brand,
    mobileType: model,
    sysVersions: VERSIONS[Math.floor(Math.random() * VERSIONS.length)],
    deviceType: '1',
    deviceToken: '',
  };
}
