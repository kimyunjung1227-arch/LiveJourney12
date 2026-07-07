import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconChevronRight } from '@tabler/icons-react';
import UserPostsList, { useUserPosts } from './UserPostsList';

const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const KEY = '#4DB8E8';

const PREVIEW_COUNT = 8;

/**
 * 프로필 안의 "게시물" 미리보기 섹션.
 * - 최신 게시물을 정사각형 썸네일 + 하단 장소명으로,
 *   한 화면에 3개씩 보이는 가로 스크롤(좌우 스와이프)로 보여주고
 * - 게시물이 8개 이상이면 "모두 보기" 버튼 → 전용 게시물 화면으로 이동
 *
 * @param {object} props
 * @param {string} props.userId 대상 사용자 UUID
 * @param {string} props.seeAllTo 전체보기 시 이동할 라우트 경로
 */
export default function ProfilePostsSection({ userId, seeAllTo }) {
  const navigate = useNavigate();
  // 가로 미리보기는 최대 PREVIEW_COUNT개. 8개 이상이면 "모두 보기"를 노출한다.
  const { posts, loading } = useUserPosts(userId, PREVIEW_COUNT);
  const hasMore = posts.length >= PREVIEW_COUNT;
  const preview = posts.slice(0, PREVIEW_COUNT);

  return (
    <section style={{ marginBottom: 28 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
        <p className="m-0" style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRIMARY }}>
          게시물
        </p>
        {hasMore && (
          <button
            type="button"
            onClick={() => navigate(seeAllTo)}
            className="flex items-center"
            style={{
              gap: 2,
              padding: '4px 0 4px 8px',
              background: 'transparent',
              border: 'none',
              color: KEY,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            모두 보기
            <IconChevronRight size={15} stroke={2} />
          </button>
        )}
      </div>

      {loading ? (
        <div
          className="text-center"
          style={{ padding: '24px 0', color: TEXT_SECONDARY, fontSize: 12.5 }}
        >
          게시물 불러오는 중...
        </div>
      ) : (
        <UserPostsList posts={preview} horizontal />
      )}
    </section>
  );
}
