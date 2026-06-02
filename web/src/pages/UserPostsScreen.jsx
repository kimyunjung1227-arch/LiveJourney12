import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IconArrowLeft } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../hooks/useProfile';
import UserPostsList, { useUserPosts } from '../components/profile/UserPostsList';
import PageSeo from '../components/PageSeo';
import { PAGE_SEO } from '../config/seo';

const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const BORDER_LIGHT = '#E8E8E8';

/**
 * 한 사용자가 올린 게시물 전체 목록 화면.
 * - /profile/posts        : 내 게시물 (로그인 사용자)
 * - /user/:userId/posts   : 특정 사용자의 게시물
 */
export default function UserPostsScreen() {
  const navigate = useNavigate();
  const { userId: paramUserId } = useParams();
  const { user } = useAuth();
  const userId = paramUserId || user?.id || null;

  const { data } = useProfile(userId);
  const { posts, loading } = useUserPosts(userId, null);

  const name = data?.user?.name || '';
  const title = name ? `${name}의 게시물` : '게시물';

  return (
    <div style={{ background: '#fff', minHeight: '100vh', paddingBottom: 32 }}>
      <PageSeo {...(PAGE_SEO.userProfile || PAGE_SEO.profile)} />

      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          height: 52,
          padding: '0 12px',
          borderBottom: `1px solid ${BORDER_LIGHT}`,
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로가기"
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 36,
            height: 36,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconArrowLeft size={22} color={TEXT_PRIMARY} />
        </button>
        <span
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: TEXT_PRIMARY,
            maxWidth: 'calc(100% - 120px)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>
      </div>

      <div style={{ padding: '4px 18px 0' }}>
        {loading ? (
          <div
            className="text-center"
            style={{ padding: 40, color: TEXT_SECONDARY, fontSize: 13 }}
          >
            불러오는 중...
          </div>
        ) : (
          <>
            {posts.length > 0 && (
              <p
                className="m-0"
                style={{ fontSize: 12.5, color: TEXT_SECONDARY, padding: '12px 0 4px' }}
              >
                총 {posts.length}개
              </p>
            )}
            <UserPostsList posts={posts} />
          </>
        )}
      </div>
    </div>
  );
}
