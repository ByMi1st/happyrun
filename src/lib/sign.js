import crypto from 'crypto';
import { APPKEY, APPSECRET } from '../config.js';

const SPECIAL_CHARS = [' ', '~', '!', '(', ')', "'"];

export function computeSign(url, body = null) {
  const u = new URL(url);
  const params = u.searchParams;
  const sortedKeys = [...params.keys()].sort();

  let signStr = '';
  for (const key of sortedKeys) {
    const value = params.get(key);
    if (value !== null && value !== '') {
      signStr += key + value;
    }
  }

  signStr += APPKEY + APPSECRET;

  if (body) {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    signStr += bodyStr;
  }

  let hasSpecial = false;
  for (const ch of SPECIAL_CHARS) {
    if (signStr.includes(ch)) {
      hasSpecial = true;
      break;
    }
  }

  if (hasSpecial) {
    for (const ch of SPECIAL_CHARS) {
      signStr = signStr.replaceAll(ch, '');
    }
    signStr = encodeURIComponent(signStr);
    return md5(signStr).toUpperCase() + 'encodeutf8';
  }

  return md5(signStr).toUpperCase();
}

function md5(str) {
  return crypto.createHash('md5').update(str, 'utf8').digest('hex');
}
