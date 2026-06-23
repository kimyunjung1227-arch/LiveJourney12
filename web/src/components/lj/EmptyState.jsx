import { LJ } from './tokens';

/**
 * 전 화면 공통 빈 상태(empty state).
 * - 아이콘 없이 문구만 노출 (제목 + 선택적 설명)
 * - 하단 액션 버튼은 "가벼운" 톤: 연한 하늘색 배경 + 키컬러 글자, 그림자 없음.
 *
 * props
 *  - title       : 굵은 제목 (string | ReactNode)
 *  - description : 보조 설명 (string | ReactNode, 선택)
 *  - actionLabel : 버튼 문구 (선택)
 *  - onAction    : 버튼 클릭 핸들러 (선택)
 *  - padding     : 컨테이너 패딩 오버라이드 (선택)
 */
export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  padding = '56px 24px',
}) {
  return (
    <div
      style={{
        padding,
        textAlign: 'center',
        color: LJ.textSecondary,
        fontFamily: LJ.fontStack,
      }}
    >
      {title != null && (
        <p
          style={{
            margin: 0,
            color: LJ.textPrimary,
            fontSize: 15,
            fontWeight: 700,
            lineHeight: 1.45,
          }}
        >
          {title}
        </p>
      )}
      {description != null && (
        <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.6 }}>
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          style={{
            marginTop: 18,
            padding: '8px 16px',
            background: LJ.keyBgLight,
            color: LJ.keyTextDark,
            border: 'none',
            borderRadius: 999,
            fontFamily: LJ.fontStack,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
