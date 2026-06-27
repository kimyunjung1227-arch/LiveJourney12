import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { IconArrowLeft, IconMapPin, IconX, IconPlus } from '@tabler/icons-react';
import { LJ } from '../components/lj/tokens';
import { fetchPostByIdSupabase, updatePostSupabase, mapSupabasePostRowToPost } from '../api/postsSupabase';
import { uploadImage } from '../api/upload';
import { useAuth } from '../contexts/AuthContext';
import { useLoginGate } from '../hooks/useLoginGate';
import { logger } from '../utils/logger';
import { ensureKakaoMapsServicesReady } from '../utils/kakaoPlacesGeocode';
import { extractRegionFromAddress, reverseGeocodeToPlaceDetail } from '../utils/locationFromGeocode';
import { resolveRegionFromLocationInput } from '../utils/regionLocationMapping';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MEDIAS = 10;

const toHttpsPersistent = (u) => {
  if (typeof u !== 'string' || !u.trim()) return null;
  let t = u.trim();
  if (t.startsWith('http://') && /\.supabase\.co/i.test(t)) t = t.replace(/^http:/i, 'https:');
  return t.startsWith('https://') ? t : null;
};

let mediaKeySeq = 0;
const nextMediaKey = () => {
  mediaKeySeq += 1;
  return `m${mediaKeySeq}`;
};

/**
 * 게시물 수정 화면.
 * 구조는 업로드 정보 입력창(UploadInfoScreen)과 동일하게:
 * 헤더 → 미디어 미리보기 슬라이더 + 썸네일 → 제목 → 위치 → 설명 → 저장 버튼
 */
function PostEditScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: editId } = useParams();
  const { user } = useAuth();
  const requireLogin = useLoginGate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [region, setRegion] = useState('');
  const [coordinates, setCoordinates] = useState(null);
  // medias: { key, url, mode:'photo'|'video', file?:File }
  const [medias, setMedias] = useState([]);

  // 위치 수정(카카오 검색)
  const [locOpen, setLocOpen] = useState(false);
  const [locQuery, setLocQuery] = useState('');
  const [locResults, setLocResults] = useState([]);
  const [locLoading, setLocLoading] = useState(false);

  const addInputRef = useRef(null);

  // 기존 게시물 로드 → 폼 초기화
  useEffect(() => {
    if (!requireLogin('수정')) return undefined;
    const pid = String(editId || '').trim();
    if (!UUID_RE.test(pid)) {
      alert('이 게시물은 수정할 수 없습니다. (로컬 게시물)');
      navigate(-1);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const passed = location?.state?.post || null;
        const fresh = passed?.id === pid ? passed : await fetchPostByIdSupabase(pid, user?.id || null);
        if (cancelled) return;
        if (!fresh) {
          alert('게시물을 불러올 수 없습니다.');
          navigate(-1);
          return;
        }

        const images = (Array.isArray(fresh.images) ? fresh.images : (fresh.image ? [fresh.image] : [])).filter(Boolean);
        const videos = (Array.isArray(fresh.videos) ? fresh.videos : []).filter(Boolean);
        const loaded = [
          ...images.map((url) => ({ key: nextMediaKey(), url, mode: 'photo', file: null })),
          ...videos.map((url) => ({ key: nextMediaKey(), url, mode: 'video', file: null })),
        ];

        setMedias(loaded);
        setTitle(fresh.title || '');
        setBody(fresh.note || fresh.content || '');
        setPlaceName(fresh.placeName || fresh.detailedLocation || fresh.location || '');
        setRegion(fresh.region || '');
        setCoordinates(fresh.coordinates || null);
      } catch (e) {
        logger.error('수정 화면 초기화 실패:', e);
        alert('게시물을 불러오지 못했습니다.');
        navigate(-1);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // 카카오 Places 키워드 검색 (debounced) — UploadInfoScreen 과 동일
  useEffect(() => {
    if (!locOpen) return undefined;
    const q = String(locQuery || '').trim();
    if (!q) {
      setLocResults([]);
      setLocLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLocLoading(true);
    const timer = setTimeout(async () => {
      try {
        await ensureKakaoMapsServicesReady();
        if (cancelled) return;
        if (!window.kakao?.maps?.services) {
          setLocResults([]);
          return;
        }
        const places = new window.kakao.maps.services.Places();
        places.keywordSearch(
          q,
          (data, status) => {
            if (cancelled) return;
            if (status !== window.kakao.maps.services.Status.OK || !Array.isArray(data)) {
              setLocResults([]);
            } else {
              setLocResults(data.slice(0, 8));
            }
            setLocLoading(false);
          },
          { size: 10 },
        );
      } catch {
        if (!cancelled) {
          setLocResults([]);
          setLocLoading(false);
        }
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [locOpen, locQuery]);

  const selectLocResult = (r) => {
    const lat = parseFloat(r.y);
    const lng = parseFloat(r.x);
    const name = r.place_name || r.address_name || locQuery;
    const nextRegion = extractRegionFromAddress(r.road_address_name || r.address_name || '');
    setPlaceName(name);
    setRegion(nextRegion || region);
    if (Number.isFinite(lat) && Number.isFinite(lng)) setCoordinates({ lat, lng });
    setLocOpen(false);
    setLocQuery('');
    setLocResults([]);
  };

  // 검색 결과 대신 직접 친 이름을 그대로 사용
  const useTypedLocationAsName = async () => {
    const text = String(locQuery || '').trim();
    if (!text) return;
    let nextRegion = extractRegionFromAddress(text);
    const lat = coordinates?.lat ?? null;
    const lng = coordinates?.lng ?? null;
    if (!nextRegion && Number.isFinite(lat) && Number.isFinite(lng)) {
      try {
        const detail = await reverseGeocodeToPlaceDetail(lat, lng);
        if (detail?.region) nextRegion = detail.region;
      } catch (_) { /* ignore */ }
    }
    setPlaceName(text);
    setRegion(nextRegion || region);
    setLocOpen(false);
    setLocQuery('');
    setLocResults([]);
  };

  const remainingSlots = Math.max(0, MAX_MEDIAS - medias.length);
  const canAddMore = remainingSlots > 0;

  const handleAddFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    if (picked.length === 0) return;
    const sliced = picked.slice(0, remainingSlots);
    const added = sliced.map((f) => ({
      key: nextMediaKey(),
      url: URL.createObjectURL(f),
      mode: f.type?.startsWith('video') ? 'video' : 'photo',
      file: f,
    }));
    setMedias((prev) => [...prev, ...added]);
  };

  const removeMediaAt = (index) => {
    setMedias((prev) => {
      const target = prev[index];
      if (target?.file && target.url) {
        try { URL.revokeObjectURL(target.url); } catch (_) {}
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const canSave =
    !saving &&
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    placeName.trim().length > 0 &&
    medias.length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    if (!requireLogin('수정')) return;
    setSaving(true);
    try {
      // 새로 추가한 파일만 업로드, 기존 URL 은 그대로 유지
      const resolved = [];
      for (const m of medias) {
        if (m.file) {
          try {
            const res = await uploadImage(m.file);
            const url = toHttpsPersistent(res?.url);
            if (res?.success && url) resolved.push({ url, mode: m.mode });
          } catch (err) {
            logger.warn('미디어 업로드 실패:', err?.message || err);
          }
        } else {
          const url = toHttpsPersistent(m.url);
          if (url) resolved.push({ url, mode: m.mode });
        }
      }

      const images = Array.from(new Set(resolved.filter((m) => m.mode === 'photo').map((m) => m.url)));
      const videos = Array.from(new Set(resolved.filter((m) => m.mode === 'video').map((m) => m.url)));

      if (images.length === 0 && videos.length === 0) {
        alert('미디어가 서버에 올라가지 않았습니다. 잠시 후 다시 시도해 주세요.');
        setSaving(false);
        return;
      }

      const finalPlace = placeName.trim();
      const finalRegion = region || resolveRegionFromLocationInput(finalPlace) || '기타';

      const result = await updatePostSupabase(String(editId || ''), {
        title: title.trim(),
        content: body,
        location: finalPlace,
        detailed_location: finalPlace,
        place_name: finalPlace,
        region: finalRegion,
        images,
        videos,
      });

      if (!result.success || !result.post) {
        alert('게시물을 저장하지 못했습니다. 다시 시도해 주세요.');
        setSaving(false);
        return;
      }

      const updated = mapSupabasePostRowToPost(result.post);
      window.dispatchEvent(new Event('postsUpdated'));
      navigate(`/post/${encodeURIComponent(String(updated.id))}`, {
        replace: true,
        state: { post: updated },
      });
    } catch (e) {
      logger.error('수정 저장 실패:', e);
      alert('수정에 실패했어요. 다시 시도해 주세요.');
      setSaving(false);
    }
  };

  const shell = {
    background: '#fff',
    minHeight: '100vh',
    fontFamily: LJ.fontStack,
    color: LJ.textPrimary,
    paddingBottom: 24,
  };

  if (loading) {
    return (
      <div style={{ ...shell, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 13, color: LJ.textTertiary }}>불러오는 중…</span>
      </div>
    );
  }

  return (
    <div style={shell}>
      {/* 헤더 */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          background: '#fff',
          borderBottom: `1px solid ${LJ.borderLight}`,
        }}
      >
        <div
          style={{
            position: 'relative',
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px',
          }}
        >
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="뒤로"
            style={{
              width: 32,
              height: 32,
              minWidth: 0,
              minHeight: 0,
              background: 'transparent',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              color: LJ.textPrimary,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            <IconArrowLeft size={18} stroke={1.8} />
          </button>
          <span
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 16,
              fontWeight: 600,
              color: LJ.textPrimary,
              lineHeight: 1,
            }}
          >
            게시물 수정
          </span>
        </div>
      </header>

      {/* 사진/영상 미리보기 — 좌우 스와이프 */}
      {medias.length > 0 && (
        <div style={{ padding: '14px 18px 0' }}>
          <EditPreviewSlider medias={medias} placeName={placeName} />

          {/* 썸네일 스트립 + 추가 버튼 */}
          {(medias.length > 1 || canAddMore) && (
            <div
              style={{
                marginTop: 10,
                display: 'flex',
                gap: 8,
                overflowX: 'auto',
                paddingBottom: 2,
                touchAction: 'pan-x',
              }}
              className="hide-scrollbar"
            >
              {medias.map((m, i) => (
                <div
                  key={m.key}
                  style={{
                    position: 'relative',
                    width: 64,
                    height: 64,
                    flex: '0 0 auto',
                    borderRadius: 8,
                    overflow: 'hidden',
                    background: LJ.bgSurface,
                    border: i === 0 ? `1.5px solid ${LJ.key}` : `1px solid ${LJ.borderLight}`,
                  }}
                >
                  {m.mode === 'video' ? (
                    <video
                      src={m.url}
                      muted
                      playsInline
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <img
                      src={m.url}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  )}
                  {medias.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMediaAt(i)}
                      aria-label="미디어 삭제"
                      style={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        width: 18,
                        height: 18,
                        minWidth: 0,
                        minHeight: 0,
                        borderRadius: 999,
                        background: 'rgba(0,0,0,0.7)',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <IconX size={11} stroke={2.5} />
                    </button>
                  )}
                </div>
              ))}
              {canAddMore && (
                <>
                  <button
                    type="button"
                    onClick={() => addInputRef.current?.click()}
                    aria-label="미디어 추가"
                    style={{
                      width: 64,
                      height: 64,
                      minWidth: 0,
                      minHeight: 0,
                      flex: '0 0 auto',
                      borderRadius: 8,
                      background: '#fff',
                      border: `1.5px dashed ${LJ.key}`,
                      cursor: 'pointer',
                      color: LJ.key,
                      display: 'inline-flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 2,
                      padding: 0,
                    }}
                  >
                    <IconPlus size={20} stroke={2} />
                  </button>
                  <input
                    ref={addInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleAddFiles}
                  />
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* 제목 (필수) */}
      <section style={{ padding: '16px 18px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: LJ.textPrimary }}>제목</span>
          <span
            style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: LJ.error }}
          />
        </div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={40}
          placeholder="예: 지금 윤중로 벚꽃 절정"
          style={{
            width: '100%',
            padding: '13px 16px',
            background: LJ.bgSurface,
            border: `1px solid ${LJ.borderLight}`,
            borderRadius: 12,
            fontFamily: LJ.fontStack,
            fontSize: 15,
            fontWeight: 600,
            color: LJ.textPrimary,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </section>

      {/* 위치 */}
      <section style={{ padding: '14px 18px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconMapPin size={14} stroke={1.8} color={LJ.textSecondary} />
            <span style={{ fontSize: 13, fontWeight: 600, color: LJ.textPrimary }}>위치</span>
          </div>
          <button
            type="button"
            onClick={() => setLocOpen((v) => !v)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '4px 6px',
              minHeight: 0,
              color: LJ.key,
              fontFamily: LJ.fontStack,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {locOpen ? '닫기' : '위치 수정'}
          </button>
        </div>
        <div
          style={{
            background: LJ.bgSurface,
            borderRadius: 10,
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: placeName ? LJ.textPrimary : LJ.textTertiary,
                lineHeight: 1.35,
                wordBreak: 'keep-all',
              }}
            >
              {placeName || '위치 정보가 없어요 — "위치 수정"으로 검색해 주세요'}
            </div>
            {region && (
              <div
                style={{
                  marginTop: 3,
                  fontSize: 11.5,
                  color: LJ.textSecondary,
                  lineHeight: 1.35,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <IconMapPin size={11} stroke={1.8} color={LJ.textTertiary} />
                <span>{region}</span>
              </div>
            )}
          </div>
        </div>

        {locOpen && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                autoFocus
                value={locQuery}
                onChange={(e) => setLocQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    useTypedLocationAsName();
                  }
                }}
                placeholder="장소를 검색하거나 직접 입력 (예: 석촌호수, 성수역)"
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '10px 12px',
                  background: '#fff',
                  border: `1px solid ${LJ.borderLight}`,
                  borderRadius: 10,
                  fontSize: 13,
                  fontFamily: LJ.fontStack,
                  color: LJ.textPrimary,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={useTypedLocationAsName}
                disabled={!locQuery.trim()}
                style={{
                  padding: '0 12px',
                  minHeight: 0,
                  background: locQuery.trim() ? LJ.key : LJ.borderLight,
                  color: locQuery.trim() ? '#fff' : LJ.textTertiary,
                  border: 'none',
                  borderRadius: 10,
                  fontFamily: LJ.fontStack,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: locQuery.trim() ? 'pointer' : 'default',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                이 이름 사용
              </button>
            </div>
            {locQuery.trim() && (
              <div
                style={{
                  marginTop: 6,
                  background: '#fff',
                  border: `1px solid ${LJ.borderLight}`,
                  borderRadius: 10,
                  maxHeight: 220,
                  overflowY: 'auto',
                }}
              >
                {locLoading ? (
                  <div style={{ padding: 12, fontSize: 12, color: LJ.textTertiary }}>검색 중…</div>
                ) : locResults.length === 0 ? (
                  <div style={{ padding: 12, fontSize: 12, color: LJ.textTertiary }}>검색 결과가 없어요</div>
                ) : (
                  locResults.map((r) => (
                    <button
                      key={r.id || `${r.x}|${r.y}|${r.place_name}`}
                      type="button"
                      onClick={() => selectLocResult(r)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: `1px solid ${LJ.borderLight}`,
                        padding: '10px 12px',
                        cursor: 'pointer',
                        fontFamily: LJ.fontStack,
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, color: LJ.textPrimary }}>{r.place_name}</div>
                      <div style={{ fontSize: 11, color: LJ.textSecondary, marginTop: 2 }}>
                        {r.road_address_name || r.address_name}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 설명 (필수) */}
      <section style={{ padding: '18px 18px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: LJ.textPrimary }}>설명</span>
          <span
            style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: LJ.error }}
          />
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="예: 윤중로 80% 만개, 주말이 절정일 듯"
          style={{
            width: '100%',
            minHeight: 150,
            padding: '14px 16px',
            background: LJ.bgSurface,
            border: `1px solid ${LJ.borderLight}`,
            borderRadius: 12,
            fontFamily: LJ.fontStack,
            fontSize: 14,
            color: LJ.textPrimary,
            resize: 'vertical',
            outline: 'none',
            lineHeight: 1.6,
            boxSizing: 'border-box',
          }}
        />
      </section>

      {/* 저장 버튼 */}
      <div style={{ padding: '16px 18px 0' }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          style={{
            width: '100%',
            padding: 15,
            background: canSave ? LJ.key : LJ.bgSurface,
            color: canSave ? '#fff' : LJ.textTertiary,
            border: 'none',
            borderRadius: 12,
            fontFamily: LJ.fontStack,
            fontSize: 15,
            fontWeight: 700,
            cursor: canSave ? 'pointer' : 'not-allowed',
          }}
        >
          {saving ? '저장 중...' : '수정 완료'}
        </button>
      </div>
    </div>
  );
}

/**
 * 수정 화면 대표 미리보기 슬라이더 — 좌우 스와이프로 전체 미리보기.
 * UploadInfoScreen 의 슬라이더 구조를 따르되, 촬영 인증/회전은 제외.
 */
function EditPreviewSlider({ medias, placeName }) {
  const [idx, setIdx] = React.useState(0);
  const [dragOffset, setDragOffset] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const startXRef = React.useRef(0);
  const startYRef = React.useRef(0);
  const lockedAxisRef = React.useRef(null);
  const activePointerIdRef = React.useRef(null);

  const SWIPE_COMMIT_PX = 40;
  const N = medias.length;

  React.useEffect(() => {
    if (idx >= N) setIdx(Math.max(0, N - 1));
  }, [N, idx]);

  const current = medias[idx] || medias[0];

  const onPointerDown = (e) => {
    if (N <= 1) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    activePointerIdRef.current = e.pointerId;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    lockedAxisRef.current = null;
    setIsDragging(true);
    setDragOffset(0);
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (_) {}
  };

  const onPointerMove = (e) => {
    if (!isDragging || activePointerIdRef.current !== e.pointerId) return;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;
    if (lockedAxisRef.current === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      lockedAxisRef.current = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
    }
    if (lockedAxisRef.current !== 'x') return;
    if (e.cancelable) e.preventDefault();
    let dragX = dx;
    if ((idx === 0 && dx > 0) || (idx === N - 1 && dx < 0)) {
      dragX = dx * 0.35;
    }
    setDragOffset(dragX);
  };

  const finishDrag = (e) => {
    if (!isDragging) return;
    if (activePointerIdRef.current != null && activePointerIdRef.current !== e?.pointerId) return;
    const dx = dragOffset;
    setIsDragging(false);
    setDragOffset(0);
    activePointerIdRef.current = null;
    if (lockedAxisRef.current === 'x' && Math.abs(dx) >= SWIPE_COMMIT_PX) {
      setIdx((prev) => Math.max(0, Math.min(N - 1, prev + (dx < 0 ? 1 : -1))));
    }
    lockedAxisRef.current = null;
    try {
      if (e?.pointerId != null) e?.currentTarget?.releasePointerCapture?.(e.pointerId);
    } catch (_) {}
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: 280,
        background: LJ.bgSurface,
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          touchAction: 'pan-y',
          transform: `translate3d(calc(${-idx * 100}% + ${dragOffset}px), 0, 0)`,
          transition: isDragging ? 'none' : 'transform 320ms cubic-bezier(0.22, 0.7, 0.2, 1)',
          cursor: N > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
          willChange: 'transform',
        }}
      >
        {medias.map((m, i) => (
          <div key={m.key} style={{ flex: '0 0 100%', width: '100%', height: '100%', background: '#000' }}>
            {m.mode === 'video' ? (
              <video
                src={m.url}
                controls
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000', display: 'block' }}
              />
            ) : (
              <img
                src={m.url}
                alt={`미리보기 ${i + 1}`}
                draggable="false"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  userSelect: 'none',
                  WebkitUserDrag: 'none',
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* N / M */}
      {N > 1 && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            padding: '4px 9px',
            background: 'rgba(0,0,0,0.7)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            borderRadius: 6,
            backdropFilter: 'blur(8px)',
            pointerEvents: 'none',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {idx + 1} / {N}
        </div>
      )}

      {/* 장소 */}
      {placeName && (
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            left: 10,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 10px',
            background: 'rgba(0,0,0,0.7)',
            borderRadius: 6,
            backdropFilter: 'blur(8px)',
            maxWidth: 'calc(100% - 20px)',
            pointerEvents: 'none',
          }}
        >
          <IconMapPin size={12} stroke={2} color={LJ.key} />
          <span
            style={{
              color: '#fff',
              fontSize: 11,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {placeName}
          </span>
        </div>
      )}

      {/* 페이지 점 인디케이터 (5장 이하) */}
      {N > 1 && N <= 5 && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 10,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 6,
            pointerEvents: 'none',
          }}
        >
          {medias.map((m, i) => (
            <span
              key={m.key}
              style={{
                width: i === idx ? 16 : 6,
                height: 6,
                borderRadius: 999,
                background: i === idx ? '#fff' : 'rgba(255,255,255,0.5)',
                transition: 'all 160ms ease-out',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default PostEditScreen;
