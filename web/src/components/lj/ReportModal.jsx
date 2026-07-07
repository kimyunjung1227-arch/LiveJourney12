import React, { useState } from 'react';
import { IconX } from '@tabler/icons-react';
import { LJ } from './tokens';
import { supabase } from '../../utils/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

const REASONS = [
  { id: 'spam', label: '스팸·도배' },
  { id: 'inappropriate', label: '부적절한 콘텐츠' },
  { id: 'misinformation', label: '허위 정보' },
  { id: 'harassment', label: '괴롭힘·혐오' },
  { id: 'other', label: '기타' },
];

/**
 * 게시물 신고 모달.
 * - 사유 선택 + 선택적 상세 입력 → lj_post_reports에 insert
 * - 비로그인 사용자도 가능 (reporter_id NULL)
 */
export function ReportModal({ postId, onClose }) {
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!reason || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: insertError } = await supabase.from('lj_post_reports').insert({
        post_id: postId,
        reporter_id: user?.id ?? null,
        reason,
        detail: detail.trim() || null,
      });
      if (insertError) throw insertError;
      setDone(true);
      setTimeout(() => onClose?.(), 1200);
    } catch (e) {
      setError(e.message || '신고 접수에 실패했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="게시물 신고"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 1000,
        fontFamily: LJ.fontStack,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 414,
          background: '#fff',
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          padding: '18px 18px calc(18px + env(safe-area-inset-bottom))',
          boxShadow: '0 -10px 30px rgba(0,0,0,0.12)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: LJ.textPrimary }}>
            게시물 신고
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 6,
              cursor: 'pointer',
              color: LJ.textSecondary,
              display: 'inline-flex',
            }}
          >
            <IconX size={18} stroke={2} />
          </button>
        </div>

        {done ? (
          <p
            style={{
              margin: '24px 0 12px',
              fontSize: 13,
              color: LJ.textPrimary,
              textAlign: 'center',
            }}
          >
            신고가 접수됐어요. 검토 후 조치해드릴게요.
          </p>
        ) : (
          <>
            <p style={{ marginTop: 8, marginBottom: 12, fontSize: 12, color: LJ.textSecondary }}>
              어떤 점이 문제인가요?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {REASONS.map((r) => {
                const active = reason === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setReason(r.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '11px 12px',
                      border: `1px solid ${active ? LJ.key : LJ.borderLight}`,
                      background: active ? LJ.keyBgLight : '#fff',
                      borderRadius: 10,
                      color: active ? LJ.keyTextDark : LJ.textPrimary,
                      fontSize: 13,
                      fontWeight: active ? 600 : 500,
                      fontFamily: LJ.fontStack,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {r.label}
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        border: `1.5px solid ${active ? LJ.key : LJ.borderLight}`,
                        background: active ? LJ.key : 'transparent',
                        display: 'inline-block',
                      }}
                    />
                  </button>
                );
              })}
            </div>

            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="자세히 알려주세요 (선택)"
              rows={3}
              maxLength={1500}
              style={{
                width: '100%',
                marginTop: 12,
                padding: '10px 12px',
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

            {error && (
              <p style={{ marginTop: 8, fontSize: 11, color: LJ.error }}>{error}</p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!reason || submitting}
              style={{
                width: '100%',
                marginTop: 14,
                padding: '12px',
                background: !reason || submitting ? LJ.borderLight : LJ.key,
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                fontFamily: LJ.fontStack,
                fontSize: 14,
                fontWeight: 600,
                cursor: !reason || submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? '접수 중...' : '신고하기'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default ReportModal;
