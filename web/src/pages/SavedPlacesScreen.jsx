import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconArrowLeft,
  IconBookmarkFilled,
  IconShare3,
  IconMapPin,
} from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { useSavedPlaces } from '../hooks/useSavedPlaces';
import PageSeo from '../components/PageSeo';
import { PAGE_SEO } from '../config/seo';

const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const BORDER_LIGHT = '#E8E8E8';
const KEY = '#4DB8E8';
const BG_SURFACE = '#EEF2F6';

/**
 * 저장한 장소 — 사진 중심 2열 그리드(세로로 긴 직사각형).
 * - 본인만 볼 수 있는 비공개 목록 (interest_places RLS: user_id = auth.uid()).
 * - 공유는 명시적 공유 버튼을 눌렀을 때만 (Web Share API → 실패 시 링크 복사).
 * - 카드: 사진을 크게 강조, 하단에 장소명/지역 표시.
 */
export default function SavedPlacesScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id || null;
  const { places, loading, remove } = useSavedPlaces(userId);
  const [toast, setToast] = useState('');

  const goPlace = (place) => {
    const key = place.placeId || place.name;
    if (!key) return;
    navigate(`/place/${encodeURIComponent(key)}`);
  };

  const showToast = (msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(''), 1800);
  };

  // 사용자가 "공유"를 원할 때만 실행 — 저장 목록 자체는 비공개.
  const sharePlace = async (e, place) => {
    e.preventDefault();
    e.stopPropagation();
    const key = place.placeId || place.name;
    const url = `${window.location.origin}/place/${encodeURIComponent(key)}`;
    const text = place.region ? `${place.name} · ${place.region}` : place.name;
    try {
      if (navigator.share) {
        await navigator.share({ title: place.name, text, url });
        return;
      }
    } catch {
      return; // 사용자가 공유 시트를 닫음 — 조용히 종료
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast('링크를 복사했어요');
    } catch {
      showToast('링크 복사에 실패했어요');
    }
  };

  const unsave = (e, place) => {
    e.preventDefault();
    e.stopPropagation();
    remove(place.name);
  };

  return (
    <div style={{ background: '#fff', minHeight: '100vh', paddingBottom: 40 }}>
      <PageSeo {...PAGE_SEO.profile} />
      <Header onBack={() => navigate(-1)} />

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: TEXT_SECONDARY, fontSize: 13 }}>
          불러오는 중...
        </div>
      ) : !places || places.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <p
            style={{
              margin: 0,
              padding: '12px 16px 4px',
              fontSize: 12,
              color: TEXT_SECONDARY,
            }}
          >
            나만 볼 수 있는 목록이에요. 공유하려면 사진의 공유 버튼을 누르세요.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              padding: '8px 16px 16px',
            }}
          >
            {places.map((p) => (
              <SavedPlaceCard
                key={p.id}
                place={p}
                onOpen={() => goPlace(p)}
                onShare={(e) => sharePlace(e, p)}
                onUnsave={(e) => unsave(e, p)}
              />
            ))}
          </div>
        </>
      )}

      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 32,
            transform: 'translateX(-50%)',
            zIndex: 50,
            background: 'rgba(15,23,42,0.92)',
            color: '#fff',
            padding: '10px 16px',
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function SavedPlaceCard({ place, onOpen, onShare, onUnsave }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${place.name} 장소 보기`}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '3 / 4',
        borderRadius: 16,
        overflow: 'hidden',
        background: BG_SURFACE,
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        display: 'block',
        textAlign: 'left',
      }}
    >
      {place.photoUrl ? (
        <img
          src={place.photoUrl}
          alt={place.name}
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconMapPin size={30} color="#B6C2CE" stroke={1.6} />
        </div>
      )}

      {/* 하단 그라데이션 + 장소명 (사진 강조, 장소는 하단) */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '28px 12px 11px',
          background: 'linear-gradient(to top, rgba(15,23,42,0.78), rgba(15,23,42,0))',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: '#fff',
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textShadow: '0 1px 4px rgba(0,0,0,0.35)',
          }}
        >
          {place.name}
        </div>
        {(place.region || place.postsCount > 0) && (
          <div
            style={{
              marginTop: 2,
              fontSize: 11,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.88)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {place.region ? place.region : ''}
            {place.region && place.postsCount > 0 ? ' · ' : ''}
            {place.postsCount > 0 ? `사진 ${place.postsCount}장` : ''}
          </div>
        )}
      </div>

      {/* 저장 해제 (좌상단) */}
      <span
        role="button"
        tabIndex={0}
        onClick={onUnsave}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onUnsave(e);
        }}
        aria-label="저장 해제"
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          width: 32,
          height: 32,
          borderRadius: 999,
          background: 'rgba(15,23,42,0.45)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <IconBookmarkFilled size={17} color={KEY} />
      </span>

      {/* 공유 (우상단) — 누를 때만 공유 */}
      <span
        role="button"
        tabIndex={0}
        onClick={onShare}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onShare(e);
        }}
        aria-label="공유"
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          width: 32,
          height: 32,
          borderRadius: 999,
          background: 'rgba(15,23,42,0.45)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <IconShare3 size={17} color="#fff" />
      </span>
    </button>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: '64px 24px',
        textAlign: 'center',
        color: TEXT_SECONDARY,
        fontSize: 13,
        lineHeight: 1.7,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <IconBookmarkFilled size={32} color={BORDER_LIGHT} />
      </div>
      <p style={{ marginTop: 12, fontWeight: 700, color: TEXT_PRIMARY }}>저장한 장소가 없어요</p>
      <p style={{ marginTop: 4 }}>
        장소 페이지의 북마크 버튼을 누르면
        <br />
        여기에 사진으로 모아볼 수 있어요.
      </p>
    </div>
  );
}

function Header({ onBack }) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        height: 52,
        padding: '0 8px',
        borderBottom: `1px solid ${BORDER_LIGHT}`,
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <button
        type="button"
        onClick={onBack}
        aria-label="뒤로가기"
        style={{
          position: 'absolute',
          left: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 40,
          height: 40,
          background: 'transparent',
          border: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <IconArrowLeft size={22} color={TEXT_PRIMARY} stroke={1.8} />
      </button>
      <span style={{ fontSize: 17, fontWeight: 600, color: TEXT_PRIMARY }}>저장한 장소</span>
    </div>
  );
}
