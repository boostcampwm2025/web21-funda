import http from 'k6/http';
import { check } from 'k6';

import { makeToken } from './lib/jwt.js';

// constant-arrival-rate로 요청 시작 속도를 고정한다.
//
// 환경변수
//   BASE_URL   기본 http://localhost:3100
//   WEEK_KEY   기본 2999-01
//   SECRET     JWT 서명 시크릿 (= experiment-access-secret)
//   USER_MIN/USER_MAX  시드 사용자 ID 범위 (필수)
//   USER_IDS   samegroup 모드에서 사용할 그룹원 ID 목록(쉼표 구분, 필수)
//   RATE       초당 도착 요청 수 (필수, 스윕에서 변경)
//   DURATION   유지 시간 (기본 20s)
//   GROUP_MODE random(기본) | samegroup

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3100';
const WEEK_KEY = __ENV.WEEK_KEY || '2999-01';
const SECRET = __ENV.SECRET || 'experiment-access-secret';
const USER_MIN = Number(__ENV.USER_MIN);
const USER_MAX = Number(__ENV.USER_MAX);
const RATE = Number(__ENV.RATE || 100);
const DURATION = __ENV.DURATION || '20s';
const GROUP_MODE = __ENV.GROUP_MODE || 'random';
const SAME_GROUP_USER_IDS = (__ENV.USER_IDS || '')
  .split(',')
  .filter(userId => userId.length > 0)
  .map(userId => Number(userId));

if (!Number.isInteger(USER_MIN) || !Number.isInteger(USER_MAX)) {
  throw new Error('USER_MIN과 USER_MAX는 현재 시드에서 조회한 정수여야 합니다.');
}

if (GROUP_MODE === 'samegroup' && SAME_GROUP_USER_IDS.length === 0) {
  throw new Error('samegroup 모드에는 실제 그룹원 목록인 USER_IDS가 필요합니다.');
}

export const options = {
  summaryTrendStats: ['min', 'med', 'p(95)', 'p(99)', 'max'],
  scenarios: {
    load: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: Math.min(Math.max(RATE * 2, 50), 3000),
      maxVUs: 5000,
    },
  },
};

/**
 * 현재 부하 모드에 맞는 사용자 ID를 선택한다.
 *
 * @returns {number} 요청에 사용할 사용자 ID
 */
function pickUserId() {
  if (GROUP_MODE === 'samegroup') {
    // 실제 그룹원만 선택해야 재시드 후 ID가 달라져도 동일 그룹 부하가 유지된다.
    const userIndex = Math.floor(Math.random() * SAME_GROUP_USER_IDS.length);
    return SAME_GROUP_USER_IDS[userIndex];
  }
  return USER_MIN + Math.floor(Math.random() * (USER_MAX - USER_MIN + 1));
}

export default function () {
  const uid = pickUserId();
  const token = makeToken(uid, SECRET);
  const res = http.get(`${BASE_URL}/api/ranking/weekly?weekKey=${WEEK_KEY}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(res, { 'status 200': r => r.status === 200 });
}

/**
 * 실행 간 비교에 필요한 k6 핵심 지표만 JSON으로 축약한다.
 *
 * @param {object} data - k6가 전달한 전체 실행 요약
 * @returns {object} 출력 대상별 요약 문자열
 */
export function handleSummary(data) {
  const m = data.metrics;
  const dur = m.http_req_duration ? m.http_req_duration.values : {};
  const out = {
    rate_offered: RATE,
    group_mode: GROUP_MODE,
    http_reqs: m.http_reqs ? m.http_reqs.values.count : 0,
    rps_completed: m.http_reqs ? Number(m.http_reqs.values.rate.toFixed(1)) : 0,
    dropped_iterations: m.dropped_iterations ? m.dropped_iterations.values.count : 0,
    failed_rate: m.http_req_failed ? m.http_req_failed.values.rate : 0,
    p50_ms: dur.med ? Number(dur.med.toFixed(2)) : null,
    p95_ms: dur['p(95)'] ? Number(dur['p(95)'].toFixed(2)) : null,
    p99_ms: dur['p(99)'] ? Number(dur['p(99)'].toFixed(2)) : null,
    max_ms: dur.max ? Number(dur.max.toFixed(2)) : null,
  };
  const result = {};
  result['stdout'] = `\n${JSON.stringify(out)}\n`;
  if (__ENV.SUMMARY_OUT) {
    result[__ENV.SUMMARY_OUT] = JSON.stringify(out);
  }
  return result;
}
