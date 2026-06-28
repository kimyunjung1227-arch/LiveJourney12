import React from 'react';
import { IconShieldX, IconShieldCheck, IconMapPin, IconX } from '@tabler/icons-react';
import { LJ } from './tokens';
import { formatTimeAgo } from '../../lib/exif/formatTimeAgo';

/* 공통 모달 프레임 */
function ModalShell({ onClose, children }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 1100,
        fontFamily: LJ.fontStack,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 414,
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * EXIF 거부 모달
 * reason: 'too_old' (24시간 초과) | 'no_exif' (정보 없음)
 */
export function EXIFRejectModal({ open, reason, minutesAgo = 0, onRetake, onPickOther, onClose }) {
  if (!open) return null;

  const isTooOld = reason === 'too_old';
  const headerText = isTooOld ? '이 사진은\n지금이 아니에요' : '촬영 정보를\n찾을 수 없어요';
  const subText = isTooOld
    ? `선택한 사진의 촬영 시각이 ${minutesAgo}분 전이에요. 라이브저니는 24시간 이내 사진만 올릴 수 있어요.`
    : '다른 사진을 선택해주세요. 라이브저니는 EXIF가 있는 사진만 올릴 수 있어요.';

  return (
    <ModalShell onClose={onClose}>
      {/* 상단 */}
      <div style={{ padding: '32px 24px 22px', textAlign: 'center' }}>
        <div
          style={{
            width: 64,
            height: 64,
            margin: '0 auto 14px',
            borderRadius: '50%',
            background: 'rgba(216,80,80,0.10)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconShieldX size={30} stroke={1.8} color={LJ.error} />
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: 17,
            fontWeight: 700,
            color: LJ.textPrimary,
            lineHeight: 1.4,
            whiteSpace: 'pre-line',
          }}
        >
          {headerText}
        </h2>
        <p style={{ margin: '10px 0 0', fontSize: 12.5, color: LJ.textSecondary, lineHeight: 1.6 }}>
          {subText}
        </p>
      </div>

      {/* CTA */}
      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          type="button"
          onClick={onRetake}
          style={{
            width: '100%',
            padding: 13,
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
          지금 다시 찍기
        </button>
        <button
          type="button"
          onClick={onPickOther}
          style={{
            width: '100%',
            padding: 13,
            background: '#fff',
            color: LJ.textPrimary,
            border: `1px solid ${LJ.borderLight}`,
            borderRadius: 12,
            fontFamily: LJ.fontStack,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          다른 사진 선택
        </button>
      </div>
    </ModalShell>
  );
}

/**
 * EXIF 확인 모달 — 갤러리 사진이 1시간 이내일 때 한 번 더 확인
 */
export function EXIFConfirmModal({ open, file, takenAt, location, placeName, onContinue, onPickOther, onClose }) {
  if (!open) return null;

  // 미리보기 URL — 컴포넌트 lifecycle 안에서만 유효하면 됨
  const previewUrl = React.useMemo(() => {
    if (!file) return null;
    try {
      return URL.createObjectURL(file);
    } catch (_) {
      return null;
    }
  }, [file]);

  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        try {
          URL.revokeObjectURL(previewUrl);
        } catch (_) {}
      }
    };
  }, [previewUrl]);

  const isVideo = Boolean(file?.type && String(file.type).startsWith('video/'));

  return (
    <ModalShell onClose={onClose}>
      {/* 닫기 */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.05)',
            border: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: LJ.textSecondary,
            zIndex: 2,
          }}
        >
          <IconX size={16} stroke={2} />
        </button>
      </div>

      {/* 상단 */}
      <div style={{ padding: '28px 24px 16px', textAlign: 'center' }}>
        <div
          style={{
            width: 60,
            height: 60,
            margin: '0 auto 14px',
            borderRadius: '50%',
            background: LJ.keyBgLight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconShieldCheck size={28} stroke={1.8} color={LJ.key} />
        </div>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: LJ.textPrimary }}>
          EXIF 인증 완료
        </h2>
        <p style={{ margin: '8px 0 0', fontSize: 12.5, color: LJ.textSecondary }}>
          {isVideo
            ? '선택한 영상을 올릴 수 있어요'
            : takenAt
              ? `${formatTimeAgo(takenAt)}에 촬영된 사진이에요`
              : '촬영 시각이 확인됐어요'}
        </p>
      </div>

      {/* 미리보기 */}
      <div style={{ padding: '0 18px' }}>
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 220,
            background: LJ.bgSurface,
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          {previewUrl && (
            isVideo ? (
              <video
                src={previewUrl}
                muted
                playsInline
                controls
                style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000' }}
              />
            ) : (
              <img
                src={previewUrl}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )
          )}
          {takenAt && (
            <div
              style={{
                position: 'absolute',
                top: 8,
                left: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 9px',
                background: 'rgba(0,0,0,0.7)',
                borderRadius: 6,
                backdropFilter: 'blur(8px)',
              }}
            >
              <IconShieldCheck size={12} stroke={2} color={LJ.key} />
              <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>
                {formatTimeAgo(takenAt)}
              </span>
            </div>
          )}
          {(placeName || location) && (
            <div
              style={{
                position: 'absolute',
                bottom: 8,
                left: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 9px',
                background: 'rgba(0,0,0,0.7)',
                borderRadius: 6,
                backdropFilter: 'blur(8px)',
                maxWidth: 'calc(100% - 16px)',
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
                {placeName || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          type="button"
          onClick={onContinue}
          style={{
            width: '100%',
            padding: 13,
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
          계속하기
        </button>
        <button
          type="button"
          onClick={onPickOther}
          style={{
            width: '100%',
            padding: 13,
            background: '#fff',
            color: LJ.textPrimary,
            border: `1px solid ${LJ.borderLight}`,
            borderRadius: 12,
            fontFamily: LJ.fontStack,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          다른 사진 선택
        </button>
      </div>
    </ModalShell>
  );
}
