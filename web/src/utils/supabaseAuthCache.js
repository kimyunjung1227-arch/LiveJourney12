import { supabase } from './supabaseClient';

// gotrue-js는 내부적으로 localStorage 락을 사용합니다.
// React StrictMode(개발) / 여러 컴포넌트의 동시 호출로 getSession/getUser가 겹치면
// 락을 서로 "steal" 하면서 AbortError가 발생할 수 있어, 인플라이트 호출을 합칩니다.

let inflightSessionPromise = null;
let inflightUserPromise = null;

const withFinallyClear = (p, clear) =>
  Promise.resolve(p).finally(() => {
    try {
      clear();
    } catch {
      // ignore
    }
  });

export async function getSessionOnce() {
  if (!supabase?.auth) return { data: { session: null }, error: new Error('no_supabase_auth') };
  if (inflightSessionPromise) return inflightSessionPromise;
  inflightSessionPromise = withFinallyClear(
    supabase.auth.getSession(),
    () => {
      inflightSessionPromise = null;
    }
  );
  return inflightSessionPromise;
}

export async function getUserOnce() {
  if (!supabase?.auth) return { data: { user: null }, error: new Error('no_supabase_auth') };
  if (inflightUserPromise) return inflightUserPromise;
  inflightUserPromise = withFinallyClear(
    supabase.auth.getUser(),
    () => {
      inflightUserPromise = null;
    }
  );
  return inflightUserPromise;
}

export async function signOutSafe(opts = {}) {
  if (!supabase?.auth) return { error: null };
  try {
    // global signOut은 네트워크/권한/세션 상태에 따라 403이 날 수 있어,
    // 클라이언트 안정성 우선으로 local을 기본으로 사용합니다.
    const scope = opts.scope || 'local';
    const { error } = await supabase.auth.signOut({ scope });
    return { error };
  } catch (e) {
    // best-effort: UI는 로그아웃 상태로 전환 가능해야 함
    return { error: e };
  }
}

