import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../hooks/useProfile';
import UserPostsList, { useUserPosts } from '../components/profile/UserPostsList';
import { deletePostSupabase } from '../api/postsSupabase';
import PageSeo from '../components/PageSeo';
import { PAGE_SEO } from '../config/seo';

const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const BORDER_LIGHT = '#E8E8E8';
const KEY = '#4DB8E8';
const DANGER = '#E5484D';

/**
 * 한 사용자가 올린 게시물 전체 목록 화면.
 * - /profile/posts        : 내 게시물 (로그인 사용자) — 선택 삭제(수정) 가능
 * - /user/:userId/posts   : 특정 사용자의 게시물 (보기 전용)
 */
export default function UserPostsScreen() {
  const navigate = useNavigate();
  const { userId: paramUserId } = useParams();
  const { user } = useAuth();
  const userId = paramUserId || user?.id || null;
  const isMe = !!userId && (!paramUserId || String(userId) === String(user?.id));

  const { data } = useProfile(userId);
  const { posts: fetched, loading } = useUserPosts(userId, null);

  // 삭제 후 목록을 바로 반영하기 위해 로컬 미러로 관리
  const [posts, setPosts] = useState([]);
  useEffect(() => {
    setPosts(Array.isArray(fetched) ? fetched : []);
  }, [fetched]);

  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [deleting, setDeleting] = useState(false);

  const selectedCount = selected.size;

  const name = data?.user?.name || '';
  const title = name ? `${name}의 게시물` : '게시물';

  const exitEdit = () => {
    setEditMode(false);
    setSelected(new Set());
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allIds = useMemo(() => posts.map((p) => p.id), [posts]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(allIds));
  };

  const handleDelete = async () => {
    if (selectedCount === 0 || deleting) return;
    const ok = window.confirm(`선택한 ${selectedCount}개의 게시물을 삭제할까요? 되돌릴 수 없어요.`);
    if (!ok) return;

    setDeleting(true);
    const ids = Array.from(selected);
    const results = await Promise.all(ids.map((id) => deletePostSupabase(id)));
    const deletedIds = new Set(ids.filter((id, i) => results[i]?.success));
    const failedCount = ids.length - deletedIds.size;

    if (deletedIds.size > 0) {
      setPosts((prev) => prev.filter((p) => !deletedIds.has(p.id)));
    }
    setSelected(new Set());
    setDeleting(false);
    if (failedCount > 0) {
      window.alert(
        `${deletedIds.size}개를 삭제했어요.\n${failedCount}개는 삭제하지 못했어요(권한 또는 네트워크 문제).`
      );
    }
    // 남은 게시물이 없으면 선택 모드 종료
    if (deletedIds.size > 0 && posts.length - deletedIds.size === 0) exitEdit();
  };

  return (
    <div style={{ background: '#fff', minHeight: '100vh', paddingBottom: editMode ? 96 : 32 }}>
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
          onClick={() => (editMode ? exitEdit() : navigate(-1))}
          aria-label={editMode ? '선택 취소' : '뒤로가기'}
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            minWidth: 36,
            height: 36,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 15,
            color: TEXT_PRIMARY,
          }}
        >
          {editMode ? '취소' : <IconArrowLeft size={22} color={TEXT_PRIMARY} />}
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
          {editMode ? `${selectedCount}개 선택` : title}
        </span>

        {/* 본인 프로필 + 게시물이 있을 때만 수정/완료 노출 */}
        {isMe && posts.length > 0 && (
          <button
            type="button"
            onClick={() => (editMode ? toggleSelectAll() : setEditMode(true))}
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              height: 36,
              padding: '0 4px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: 600,
              color: editMode ? KEY : TEXT_PRIMARY,
            }}
          >
            {editMode ? (allSelected ? '전체해제' : '전체선택') : '수정'}
          </button>
        )}
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
                {editMode ? '삭제할 게시물을 선택하세요' : `총 ${posts.length}개`}
              </p>
            )}
            <UserPostsList
              posts={posts}
              selectable={editMode}
              selectedIds={selected}
              onToggleSelect={toggleSelect}
            />
          </>
        )}
      </div>

      {/* 하단 삭제 바 (선택 모드) */}
      {editMode && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 20,
            padding: '12px 18px calc(12px + env(safe-area-inset-bottom))',
            background: '#fff',
            borderTop: `1px solid ${BORDER_LIGHT}`,
          }}
        >
          <button
            type="button"
            onClick={handleDelete}
            disabled={selectedCount === 0 || deleting}
            style={{
              width: '100%',
              height: 50,
              borderRadius: 14,
              border: 'none',
              background: selectedCount === 0 ? '#F1F1F1' : DANGER,
              color: selectedCount === 0 ? '#B0B0B0' : '#fff',
              fontSize: 15,
              fontWeight: 700,
              cursor: selectedCount === 0 || deleting ? 'default' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <IconTrash size={18} stroke={2} />
            {deleting ? '삭제 중...' : selectedCount > 0 ? `${selectedCount}개 삭제` : '삭제'}
          </button>
        </div>
      )}
    </div>
  );
}
