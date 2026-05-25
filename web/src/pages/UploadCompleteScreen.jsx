import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IconCheck, IconCamera } from '@tabler/icons-react';
import { LJ } from '../components/lj/tokens';
import { supabase } from '../utils/supabaseClient';
import { formatTimeAgo } from '../lib/exif/formatTimeAgo';

/**
 * 업로드 완료 화면 (/upload/complete/:postId).
 * 라이브저니 호혜 경험의 핵심 순간 — 3가지 신호 박스로 즉각적 보람 전달.
 *
 * (실시간 조회수 / 매칭 / 대기 인원은 인프라가 아직 없어 추정값으로 채움.
 *  추후 Realtime 구독 / RPC 연결.)
 */
function UploadCompleteScreen() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);

  useEffect(() => {
    if (!postId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('posts')
        .select('id, place_name, location, region, captured_at, category, content')
        .eq('id', postId)
        .maybeSingle();
      if (!cancelled && data) setPost(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  const rawPlaceName = post?.place_name || post?.location || '여기';
  // 지역명이 있으면 "칠곡시 갤러리안나" 처럼 지역 + 장소를 함께 노출 (장소명에 이미 지역이 포함됐으면 중복 방지)
  const regionName = (post?.region || '').trim();
  const placeName =
    regionName && !rawPlaceName.startsWith(regionName)
      ? `${regionName} ${rawPlaceName}`
      : rawPlaceName;
  const captured = post?.captured_at ? new Date(post.captured_at) : null;
  const capturedAgo = captured ? formatTimeAgo(captured) : '방금';

  // 임시 신호값 — Realtime/RPC 미연결 (TODO)
  const viewingCount = 12;
  const waitingCount = 73;
  const matched = null; // { user: { nickname }, body }

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
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 600, color: LJ.textPrimary, lineHeight: 1 }}>
            업로드 완료
          </span>
        </div>
      </header>

      {/* 상단 영역 */}
      <div style={{ padding: '32px 24px', textAlign: 'center' }}>
        <div
          style={{
            width: 66,
            height: 66,
            margin: '0 auto 14px',
            borderRadius: '50%',
            background: LJ.keyBgLight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconCheck size={30} stroke={2.2} color={LJ.key} />
        </div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: LJ.textPrimary, lineHeight: 1.4 }}>
          라이브 피드에 올라갔어요
        </h2>
        <p style={{ margin: '10px 0 0', fontSize: 13, color: LJ.textSecondary, lineHeight: 1.6 }}>
          당신의 {capturedAgo} {placeName} 사진이
          <br />
          지금 다른 여행자들에게 보이고 있어요
        </p>
      </div>

      {/* 3가지 신호 박스 */}
      <div
        style={{
          padding: '0 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* 1. 자동 매칭 (있을 때만) */}
        {matched && (
          <div
            style={{
              padding: 16,
              background: LJ.keyBgLight,
              borderRadius: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: LJ.key,
                  boxShadow: '0 0 0 4px rgba(77,184,232,0.2)',
                }}
              />
              <span style={{ fontSize: 10, fontWeight: 700, color: LJ.keyTextDark, letterSpacing: 0.4 }}>
                지금 일어나는 일
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: LJ.textPrimary, lineHeight: 1.5 }}>
              {matched.user.nickname}님의 '{matched.body}' 질문에 자동 매칭됐어요
            </p>
          </div>
        )}

        {/* 2. 실시간 조회수 */}
        <div
          style={{
            padding: 16,
            background: LJ.bgSurface,
            borderRadius: 12,
          }}
        >
          <div style={{ fontSize: 11, color: LJ.textSecondary, marginBottom: 6 }}>지금 보고 있는 사람</div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: LJ.key,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {viewingCount}명
          </div>
          <div
            style={{
              marginTop: 10,
              width: '100%',
              height: 6,
              background: 'rgba(77,184,232,0.18)',
              borderRadius: 999,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.min(100, viewingCount)}%`,
                height: '100%',
                background: LJ.key,
                transition: 'width 600ms ease-out',
              }}
            />
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: LJ.textSecondary }}>
            실시간 업데이트 · 48시간 누적
          </div>
        </div>

        {/* 3. 대기 인원 */}
        <div
          style={{
            padding: 16,
            background: LJ.bgSurface,
            borderRadius: 12,
          }}
        >
          <div style={{ fontSize: 11, color: LJ.textSecondary, marginBottom: 8 }}>
            이 정보를 기다리는 사람
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: LJ.key,
                  border: '1.5px solid #fff',
                  marginLeft: i === 0 ? 0 : -8,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                }}
              />
            ))}
            <span
              style={{
                marginLeft: -8,
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: LJ.keyBgLight,
                color: LJ.keyTextDark,
                fontSize: 10,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              +{Math.max(0, waitingCount - 3)}
            </span>
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: LJ.key,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {waitingCount}명
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: LJ.textSecondary, lineHeight: 1.6 }}>
            이번 주말 서울 여행 계획 중인
            <br />
            {waitingCount}명에게 도움이 될 거예요
          </div>
        </div>
      </div>

      {/* CTA */}
      <div
        style={{
          padding: '24px 18px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
          style={{
            width: '100%',
            padding: 14,
            background: LJ.key,
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            fontFamily: LJ.fontStack,
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          홈으로 돌아가기
        </button>
        <button
          type="button"
          onClick={() => navigate('/camera', { replace: true })}
          style={{
            width: '100%',
            padding: 13,
            background: '#fff',
            color: LJ.key,
            border: `1.5px solid ${LJ.key}`,
            borderRadius: 12,
            fontFamily: LJ.fontStack,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <IconCamera size={17} stroke={1.8} />
          한 장 더 올리기
        </button>
      </div>
    </div>
  );
}

export default UploadCompleteScreen;
