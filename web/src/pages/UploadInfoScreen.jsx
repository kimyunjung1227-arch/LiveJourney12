import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconArrowLeft,
  IconShieldCheck,
  IconMapPin,
  IconClock,
  IconFlower,
  IconCloud,
  IconCalendarEvent,
  IconUsers,
  IconMoon,
  IconBuildingStore,
} from '@tabler/icons-react';
import { LJ } from '../components/lj/tokens';
import {
  getUploadSnapshot,
  subscribeUploadStore,
  resetUploadStore,
} from '../stores/uploadStore';
import { formatTimeAgo, formatTimeOfDay } from '../lib/exif/formatTimeAgo';
import { useUpload } from '../hooks/useUpload';
import { reverseGeocodeToPlace } from '../utils/locationFromGeocode';

const CATEGORIES = [
  { id: 'nature', label: '개화·자연', Icon: IconFlower },
  { id: 'weather', label: '날씨·체감', Icon: IconCloud },
  { id: 'event', label: '이벤트·축제', Icon: IconCalendarEvent },
  { id: 'crowd', label: '혼잡도·대기', Icon: IconUsers },
  { id: 'sunset', label: '노을·야경', Icon: IconMoon },
  { id: 'business', label: '영업·운영', Icon: IconBuildingStore },
];

const MAX_BODY = 100;

function UploadInfoScreen() {
  const navigate = useNavigate();
  const media = useSyncExternalStore(subscribeUploadStore, getUploadSnapshot, getUploadSnapshot);
  const { isUploading, upload, error } = useUpload();

  const [category, setCategory] = useState(null);
  const [body, setBody] = useState('');
  // placeName이 캡처 시점에 없었으면 (geocoding 미완료) 여기서 좌표로 직접 한 번 시도
  const [resolvedPlace, setResolvedPlace] = useState(media?.placeName || '');
  useEffect(() => {
    if (resolvedPlace) return;
    if (!media?.lat || !media?.lng) return;
    let cancelled = false;
    (async () => {
      try {
        const name = await reverseGeocodeToPlace(media.lat, media.lng);
        if (!cancelled && name) setResolvedPlace(name);
      } catch (_) {}
    })();
    return () => {
      cancelled = true;
    };
  }, [media?.lat, media?.lng, resolvedPlace]);

  // 미디어가 없는 상태로 직접 진입하면 카메라로 유도
  useEffect(() => {
    if (!media || !media.url) {
      // sessionStorage 백업도 비었음 — 카메라로 보내기
      const t = setTimeout(() => navigate('/camera', { replace: true }), 60);
      return () => clearTimeout(t);
    }
  }, [media, navigate]);

  const takenAtDate = useMemo(
    () => (media?.takenAt ? new Date(media.takenAt) : null),
    [media?.takenAt]
  );
  const takenLabel = useMemo(() => {
    if (!takenAtDate) return '';
    const rel = formatTimeAgo(takenAtDate);
    const tod = formatTimeOfDay(takenAtDate);
    return tod ? `${rel} · ${tod}` : rel;
  }, [takenAtDate]);

  const canUpload = !!category && !!media?.file && !isUploading;

  const handleUpload = async () => {
    if (!canUpload) return;
    try {
      const postId = await upload({
        file: media.file,
        category,
        body,
        takenAt: media.takenAt,
        lat: media.lat,
        lng: media.lng,
        placeName: resolvedPlace || media.placeName || null,
        source: media.source,
        mode: media.mode,
      });
      resetUploadStore();
      navigate(`/upload/complete/${postId}`, { replace: true });
    } catch (_) {
      // error는 훅에서 setError; 화면에 표시
    }
  };

  return (
    <div
      style={{
        background: '#fff',
        minHeight: '100vh',
        fontFamily: LJ.fontStack,
        color: LJ.textPrimary,
        paddingBottom: 24,
      }}
    >
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
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="뒤로"
              style={{
                width: 32,
                height: 32,
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
              <IconArrowLeft size={20} stroke={1.8} />
            </button>
            <span style={{ fontSize: 16, fontWeight: 600, color: LJ.textPrimary, lineHeight: 1 }}>
              정보 입력
            </span>
          </div>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!canUpload}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '6px 4px',
              color: canUpload ? LJ.key : LJ.textTertiary,
              fontFamily: LJ.fontStack,
              fontSize: 14,
              fontWeight: 700,
              cursor: canUpload ? 'pointer' : 'not-allowed',
            }}
          >
            {isUploading ? '업로드 중...' : '업로드'}
          </button>
        </div>
      </header>

      {/* 사진/영상 미리보기 */}
      {media?.url && (
        <div style={{ padding: '14px 18px 0' }}>
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
            {media.mode === 'video' ? (
              <video
                src={media.url}
                controls
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000' }}
              />
            ) : (
              <img
                src={media.url}
                alt="업로드 미리보기"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
            {/* EXIF */}
            <div
              style={{
                position: 'absolute',
                top: 10,
                left: 10,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 10px',
                background: 'rgba(0,0,0,0.7)',
                borderRadius: 6,
                backdropFilter: 'blur(8px)',
              }}
            >
              <IconShieldCheck size={12} stroke={2} color={LJ.key} />
              <span style={{ color: '#fff', fontSize: 11, fontWeight: 600, lineHeight: 1 }}>
                EXIF 자동 인증
              </span>
              {takenLabel && (
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 10.5 }}>· {takenLabel}</span>
              )}
            </div>
            {/* GPS — resolvedPlace(카카오 reverse geocode) 우선, 없으면 좌표 */}
            {(resolvedPlace || media.placeName || (media.lat && media.lng)) && (
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
                  {resolvedPlace ||
                    media.placeName ||
                    `${media.lat.toFixed(4)}, ${media.lng.toFixed(4)}`}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 카테고리 (필수) */}
      <section style={{ padding: '18px 18px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: LJ.textPrimary }}>카테고리 선택</span>
          <span
            style={{
              display: 'inline-block',
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: LJ.error,
            }}
          />
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
          }}
        >
          {CATEGORIES.map((c) => {
            const active = category === c.id;
            const Icon = c.Icon;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: 14,
                  background: active ? LJ.keyBgLight : '#fff',
                  border: active ? `1.5px solid ${LJ.key}` : `1px solid ${LJ.borderLight}`,
                  borderRadius: 10,
                  color: active ? LJ.keyTextDark : LJ.textPrimary,
                  fontFamily: LJ.fontStack,
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Icon size={18} stroke={1.8} color={active ? LJ.key : LJ.textSecondary} />
                {c.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* 한 줄 설명 (선택) */}
      <section style={{ padding: '18px 18px 0' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: LJ.textPrimary }}>한 줄 설명</span>
          <span style={{ fontSize: 11, color: LJ.textTertiary }}>선택</span>
        </div>
        <div style={{ position: 'relative' }}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))}
            placeholder="예: 윤중로 80% 만개, 주말이 절정일 듯"
            style={{
              width: '100%',
              minHeight: 60,
              padding: '12px 14px',
              background: LJ.bgSurface,
              border: `1px solid ${LJ.borderLight}`,
              borderRadius: 10,
              fontFamily: LJ.fontStack,
              fontSize: 13,
              color: LJ.textPrimary,
              resize: 'vertical',
              outline: 'none',
              lineHeight: 1.5,
            }}
          />
          <span
            style={{
              position: 'absolute',
              right: 12,
              bottom: 8,
              fontSize: 10,
              color: LJ.textTertiary,
            }}
          >
            {body.length}/{MAX_BODY}
          </span>
        </div>
      </section>

      {/* 하단 안내 */}
      <section style={{ padding: '18px 18px 0' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 14px',
            background: LJ.keyBgLight,
            borderRadius: 10,
          }}
        >
          <IconClock size={16} stroke={1.8} color={LJ.key} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: LJ.keyTextDark }}>
              48시간 라이브 노출
            </div>
            <div style={{ fontSize: 11, color: LJ.keyTextDark, opacity: 0.85, marginTop: 2 }}>
              지금 누군가 이 정보를 기다리고 있어요
            </div>
          </div>
        </div>
      </section>

      {error && (
        <section style={{ padding: '12px 18px 0' }}>
          <div
            style={{
              padding: '10px 12px',
              background: 'rgba(216,80,80,0.08)',
              border: `1px solid ${LJ.error}`,
              borderRadius: 8,
              color: LJ.error,
              fontSize: 12,
            }}
          >
            업로드 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.
          </div>
        </section>
      )}
    </div>
  );
}

export default UploadInfoScreen;
