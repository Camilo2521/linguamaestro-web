/**
 * k6 load test — LinguaMaestro critical API paths
 *
 * Run:
 *   k6 run tests/performance/load-test.js --env BASE_URL=http://localhost:3000
 *
 * Thresholds (SLOs):
 *   - p95 response time < 2000ms for all requests
 *   - Error rate < 1%
 *   - p99 exam eligibility check < 3000ms
 */
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

// Custom metrics
const eligibilityTrend = new Trend('eligibility_check_duration');
const activityLogTrend = new Trend('activity_log_duration');
const errorRate = new Rate('error_rate');
const requestCount = new Counter('total_requests');

export const options = {
  scenarios: {
    // Baseline: normal daily usage
    normal_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 10 },
        { duration: '30s', target: 0 },
      ],
    },
    // Spike: exam submission peak (e.g., end of study session)
    exam_spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      startTime: '2m',
      stages: [
        { duration: '10s', target: 30 },
        { duration: '20s', target: 30 },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<3500'],
    http_req_failed: ['rate<0.01'],
    error_rate: ['rate<0.01'],
    eligibility_check_duration: ['p(95)<1000', 'p(99)<3000'],
    activity_log_duration: ['p(95)<1500'],
  },
};

const HEADERS = {
  'Content-Type': 'application/json',
  ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
};

export default function () {
  group('Dashboard load', () => {
    const res = http.get(`${BASE_URL}/dashboard`, { headers: HEADERS });
    requestCount.add(1);
    const ok = check(res, {
      'dashboard status 200 or 307': (r) => [200, 307].includes(r.status),
    });
    errorRate.add(!ok);
  });

  sleep(1);

  group('Exam page', () => {
    const res = http.get(`${BASE_URL}/exam`, { headers: HEADERS });
    requestCount.add(1);
    eligibilityTrend.add(res.timings.duration);
    const ok = check(res, {
      'exam page accessible': (r) => [200, 307].includes(r.status),
      'exam response under 2s': (r) => r.timings.duration < 2000,
    });
    errorRate.add(!ok);
  });

  sleep(2);

  group('Learn page', () => {
    const res = http.get(`${BASE_URL}/learn`, { headers: HEADERS });
    requestCount.add(1);
    const ok = check(res, {
      'learn page accessible': (r) => [200, 307].includes(r.status),
    });
    errorRate.add(!ok);
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'test-results/k6-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, opts) {
  const indent = opts?.indent ?? '';
  const lines = [];
  lines.push(`${indent}✓ Total requests: ${data.metrics.total_requests?.values.count ?? 0}`);
  lines.push(`${indent}✓ Error rate: ${((data.metrics.http_req_failed?.values.rate ?? 0) * 100).toFixed(2)}%`);
  lines.push(`${indent}✓ p95 response time: ${data.metrics.http_req_duration?.values['p(95)']?.toFixed(0) ?? '-'}ms`);
  return lines.join('\n');
}
