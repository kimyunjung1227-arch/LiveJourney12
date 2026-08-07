import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconArrowLeft,
  IconHelpCircle,
  IconMapPin,
  IconPencilPlus,
  IconWorld,
} from '@tabler/icons-react';
import { useQuestionsList } from '../hooks/useQuestionsList';
import QuestionListCard from '../components/question/QuestionListCard';
import BottomNavigation from '../components/BottomNavigation';

const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const KEY = '#4DB8E8';
const KEY_DARK = '#1A6EA8';
const MAIN = '#26C6DA'; // tailwind primary (메인 키 컬러)

const QuestionsListScreen = () => {
  const navigate = useNavigate();
  const { data, loading } = useQuestionsList(null);

  const myRegion = data?.my_region || [];
  const otherRegion = data?.other_region || [];
  const isEmpty = !loading && myRegion.length === 0 && otherRegion.length === 0;

  return (
    <div
      style={{
        background: '#ffffff',
        minHeight: '100vh',
        color: TEXT_PRIMARY,
        paddingBottom: 110,
      }}
    >
      <div
        className="relative flex items-center sticky top-0 z-20 bg-white"
        style={{ padding: '14px 18px 12px', borderBottom: '1px solid #F0F0F0' }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로가기"
          style={{ background: 'transparent', border: 'none', padding: 4, cursor: 'pointer' }}
        >
          <IconArrowLeft size={18} color={TEXT_PRIMARY} />
        </button>
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5">
          <IconHelpCircle size={19} color={KEY} />
          <span style={{ fontSize: 16, fontWeight: 600, color: TEXT_PRIMARY }}>실시간 질문</span>
        </div>
      </div>

      <div style={{ padding: '14px 18px' }}>
        {loading ? (
          <div
            className="text-center"
            style={{ color: TEXT_SECONDARY, fontSize: 13, padding: 20 }}
          >
            로딩 중...
          </div>
        ) : isEmpty ? (
          <div
            className="flex flex-col items-center justify-center text-center"
            style={{
              padding: '60px 20px',
              borderRadius: 14,
              background: '#F5F7FA',
              border: '1px dashed #E8E8E8',
            }}
          >
            <p className="m-0" style={{ fontSize: 13, color: TEXT_SECONDARY, marginBottom: 4 }}>
              아직 질문이 없어요
            </p>
            <p className="m-0" style={{ fontSize: 11, color: '#B8B8B8' }}>
              첫 질문을 남겨보세요
            </p>
          </div>
        ) : (
          <>
            {data?.my_city && myRegion.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div className="flex items-center gap-1.5" style={{ marginBottom: 12 }}>
                  <IconMapPin size={14} color={KEY} />
                  <p className="m-0" style={{ fontSize: 12, fontWeight: 700, color: KEY_DARK }}>
                    내 지역 · {data.my_city}
                  </p>
                </div>
                <div className="flex flex-col gap-2.5">
                  {myRegion.map((q) => (
                    <QuestionListCard key={q.id} question={q} />
                  ))}
                </div>
              </div>
            )}

            {otherRegion.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5" style={{ marginBottom: 12 }}>
                  <IconWorld size={14} color={TEXT_SECONDARY} />
                  <p className="m-0" style={{ fontSize: 12, fontWeight: 700, color: TEXT_SECONDARY }}>
                    다른 지역
                  </p>
                </div>
                <div className="flex flex-col gap-2.5">
                  {otherRegion.map((q) => (
                    <QuestionListCard key={q.id} question={q} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 질문하기 FAB — 지도 화면 컨트롤 버튼과 동일한 톤 (흰 원 + 키컬러 아이콘) */}
      <button
        type="button"
        onClick={() => navigate('/question/new')}
        aria-label="질문하기"
        title="질문하기"
        className="bg-white h-[44px] rounded-full flex items-center justify-center gap-1.5"
        style={{
          position: 'fixed',
          bottom: 'calc(70px + env(safe-area-inset-bottom, 0px))',
          right: 'max(12px, calc(50vw - 195px))',
          padding: '0 16px',
          border: 'none',
          boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
          color: MAIN,
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          zIndex: 48,
        }}
      >
        <IconPencilPlus size={18} color={MAIN} stroke={2} />
        질문하기
      </button>

      <BottomNavigation />
    </div>
  );
};

export default QuestionsListScreen;
