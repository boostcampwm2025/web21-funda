import crypto from 'k6/crypto';
import encoding from 'k6/encoding';

/**
 * JWT 구성 객체를 URL 안전 Base64 문자열로 변환한다.
 *
 * @param {object} value - 인코딩할 JWT 구성 객체
 * @returns {string} URL 안전 Base64 문자열
 */
function encodeBase64Url(value) {
  return encoding.b64encode(JSON.stringify(value), 'rawurl');
}

/**
 * 부하 요청에 사용할 HS256 액세스 토큰을 생성한다.
 *
 * @param {number} userId - 토큰 주체로 사용할 사용자 ID
 * @param {string} secret - HS256 서명 시크릿
 * @returns {string} 서명된 JWT 액세스 토큰
 */
export function makeToken(userId, secret) {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url({ alg: 'HS256', typ: 'JWT' });
  const payload = encodeBase64Url({
    // 실제 토큰과 타입을 맞춰 사용자 ID 비교 결과가 달라지지 않게 한다.
    sub: String(userId),
    role: 'user',
    provider: 'github',
    iat: now,
    exp: now + 7200,
  });
  const signature = crypto.hmac('sha256', secret, `${header}.${payload}`, 'base64rawurl');
  return `${header}.${payload}.${signature}`;
}
