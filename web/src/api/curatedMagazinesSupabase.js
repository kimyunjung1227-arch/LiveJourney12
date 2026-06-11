import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';

/**
 * 큐레이션 매거진 (트리플 가이드 스타일) API.
 * - blocks: [{ type, ... }] 배열
 *   - { type: 'text', body }
 *   - { type: 'place', name, address, image_url, description, nearby, tip }
 *   - { type: 'image', image_url, caption }
 */

// 주변장소: {name, desc} 배열로 정규화(최대 3). 레거시 문자열도 변환.
const sanitizeNearby = (nearby) => {
  let arr = [];
  if (Array.isArray(nearby)) {
    arr = nearby.map((n) =>
      typeof n === 'string'
        ? { name: n.trim(), desc: '' }
        : { name: String(n?.name || '').trim(), desc: String(n?.desc || '').trim() }
    );
  } else if (typeof nearby === 'string' && nearby.trim()) {
    arr = nearby.split(/,|·|•|ㆍ|\n/).map((s) => ({ name: s.trim(), desc: '' }));
  }
  return arr.filter((n) => n.name).slice(0, 3);
};

const sanitizeBlocks = (blocks) => {
  if (!Array.isArray(blocks)) return [];
  return blocks
    .map((b) => {
      if (!b || typeof b !== 'object') return null;
      switch (b.type) {
        case 'text':
          return { type: 'text', body: String(b.body || '') };
        case 'place':
          return {
            type: 'place',
            name: String(b.name || '').trim(),
            address: String(b.address || '').trim(),
            image_url: String(b.image_url || ''),
            description: String(b.description || ''),
            nearby: sanitizeNearby(b.nearby),
            tip: String(b.tip || ''),
          };
        case 'image':
          return {
            type: 'image',
            image_url: String(b.image_url || ''),
            caption: String(b.caption || ''),
          };
        default:
          return null;
      }
    })
    .filter(Boolean);
};

const sanitizePayload = (p) => ({
  title: String(p.title || '').trim(),
  subtitle: p.subtitle ? String(p.subtitle).trim() : null,
  cover_image_url: p.cover_image_url || null,
  intro_body: p.intro_body ? String(p.intro_body) : null,
  blocks: sanitizeBlocks(p.blocks),
  region: p.region ? String(p.region).trim() : null,
  status: p.status === 'published' ? 'published' : 'draft',
  display_order: Number.isFinite(Number(p.display_order)) ? Number(p.display_order) : 0,
});

/** 관리자: 전체 목록 (draft + published) */
export async function fetchAdminMagazines() {
  try {
    const { data, error } = await supabase
      .from('curated_magazines')
      .select('id, title, subtitle, cover_image_url, region, status, published_at, display_order, created_at, updated_at')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (e) {
    logger.warn('fetchAdminMagazines 실패:', e?.message);
    return [];
  }
}

/** 공개: 발행된 매거진 목록 */
export async function fetchPublishedMagazines({ limit = 30, region } = {}) {
  try {
    let q = supabase
      .from('curated_magazines')
      .select('id, title, subtitle, cover_image_url, region, published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(limit);
    if (region) q = q.eq('region', region);
    const { data, error } = await q;
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (e) {
    logger.warn('fetchPublishedMagazines 실패:', e?.message);
    return [];
  }
}

/** 단건 조회 (admin / 공개 둘 다 — RLS 가 알아서 차단) */
export async function fetchMagazineById(id) {
  try {
    const { data, error } = await supabase
      .from('curated_magazines')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  } catch (e) {
    logger.warn('fetchMagazineById 실패:', e?.message);
    return null;
  }
}

export async function createMagazine(payload) {
  try {
    const sanitized = sanitizePayload(payload);
    if (sanitized.status === 'published') {
      sanitized.published_at = new Date().toISOString();
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) sanitized.author_id = user.id;
    const { data, error } = await supabase
      .from('curated_magazines')
      .insert(sanitized)
      .select()
      .single();
    if (error) throw error;
    return { success: true, data };
  } catch (e) {
    logger.warn('createMagazine 실패:', e?.message);
    return { success: false, error: e?.message || '저장 실패' };
  }
}

export async function updateMagazine(id, payload) {
  try {
    const sanitized = sanitizePayload(payload);
    if (sanitized.status === 'published' && !payload.published_at) {
      sanitized.published_at = new Date().toISOString();
    } else if (sanitized.status === 'draft') {
      sanitized.published_at = null;
    }
    const { data, error } = await supabase
      .from('curated_magazines')
      .update(sanitized)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return { success: true, data };
  } catch (e) {
    logger.warn('updateMagazine 실패:', e?.message);
    return { success: false, error: e?.message || '수정 실패' };
  }
}

export async function deleteMagazine(id) {
  try {
    const { error } = await supabase
      .from('curated_magazines')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    logger.warn('deleteMagazine 실패:', e?.message);
    return { success: false, error: e?.message || '삭제 실패' };
  }
}
