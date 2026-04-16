'use strict';

/**
 * JWT / 세션 시크릿을 한곳에서 관리합니다.
 * - production: 약한 기본값 없이 반드시 환경 변수(충분한 길이) 필요
 * - development: 로컬 편의를 위해 개발용 기본값 허용(경고 1회)
 */

const isProd = process.env.NODE_ENV === 'production';
const MIN_SECRET_LEN = 32;

function readTrimmed(name) {
  const v = process.env[name];
  if (!v || typeof v !== 'string') return '';
  return v.trim();
}

function assertProductionSecrets() {
  if (!isProd) return;
  const jwt = readTrimmed('JWT_SECRET');
  const session = readTrimmed('SESSION_SECRET');
  const errors = [];
  if (jwt.length < MIN_SECRET_LEN) {
    errors.push(
      `JWT_SECRET must be set to at least ${MIN_SECRET_LEN} characters (use a long random string, e.g. openssl rand -hex 32).`
    );
  }
  if (session.length < MIN_SECRET_LEN) {
    errors.push(`SESSION_SECRET must be set to at least ${MIN_SECRET_LEN} characters.`);
  }
  if (errors.length) {
    console.error('\n[security] Refusing to start in production:\n' + errors.map((e) => `  - ${e}`).join('\n'));
    process.exit(1);
  }
}

const DEV_JWT_FALLBACK =
  'lj-dev-only-jwt-secret-do-not-use-in-production-min-32-chars-ok';
const DEV_SESSION_FALLBACK =
  'lj-dev-only-session-secret-do-not-use-in-production-min-32-chars';

function getJwtSecret() {
  const s = readTrimmed('JWT_SECRET');
  if (s.length >= MIN_SECRET_LEN) return s;
  if (isProd) {
    throw new Error('JWT_SECRET is invalid (should have been validated at startup).');
  }
  if (s.length >= 16) return s;
  if (!global.__ljJwtDevWarned) {
    global.__ljJwtDevWarned = true;
    console.warn(
      '[security] JWT_SECRET is missing or shorter than 16 chars; using a dev-only default. Set JWT_SECRET (32+ chars) before production.'
    );
  }
  return DEV_JWT_FALLBACK;
}

function getSessionSecret() {
  const s = readTrimmed('SESSION_SECRET');
  if (s.length >= MIN_SECRET_LEN) return s;
  if (isProd) {
    throw new Error('SESSION_SECRET is invalid (should have been validated at startup).');
  }
  if (s.length >= 16) return s;
  if (!global.__ljSessionDevWarned) {
    global.__ljSessionDevWarned = true;
    console.warn(
      '[security] SESSION_SECRET is missing or shorter than 16 chars; using a dev-only default. Set SESSION_SECRET (32+ chars) before production.'
    );
  }
  return DEV_SESSION_FALLBACK;
}

module.exports = {
  assertProductionSecrets,
  getJwtSecret,
  getSessionSecret,
};
