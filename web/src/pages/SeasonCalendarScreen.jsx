import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconArrowLeft, IconCalendarTime } from '@tabler/icons-react';
import { useSeasonCalendar } from '../hooks/useSeasonCalendar';
import SeasonGroupSection from '../components/season/SeasonGroupSection';

const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';

const SeasonCalendarScreen = () => {
  const navigate = useNavigate();
  const { data, loading } = useSeasonCalendar();

  const empty =
    !loading &&
    data &&
    (data.peak?.length || 0) + (data.soon?.length || 0) + (data.upcoming?.length || 0) === 0;

  return (
    <div style={{ background: '#ffffff', minHeight: '100vh', color: TEXT_PRIMARY }}>
      <div
        className="flex items-center gap-3 sticky top-0 z-20 bg-white"
        style={{ padding: '14px 18px 12px', borderBottom: '1px solid #F0F0F0' }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로가기"
          style={{ background: 'transparent', border: 'none', padding: 4, cursor: 'pointer' }}
        >
          <IconArrowLeft size={22} color={TEXT_PRIMARY} />
        </button>
        <div className="flex items-center gap-1.5">
          <IconCalendarTime size={19} color="#4DB8E8" />
          <span style={{ fontSize: 16, fontWeight: 600, color: TEXT_PRIMARY }}>시즌 캘린더</span>
        </div>
      </div>

      <div style={{ padding: 18 }}>
        {loading ? (
          <div className="text-center" style={{ color: TEXT_SECONDARY, fontSize: 13, padding: 20 }}>
            로딩 중...
          </div>
        ) : empty ? (
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
              아직 등록된 시즌이 없어요
            </p>
            <p className="m-0" style={{ fontSize: 11, color: '#B8B8B8' }}>
              새로운 시즌이 시작되면 여기 모여요
            </p>
          </div>
        ) : (
          <>
            <SeasonGroupSection status="peak" cards={data?.peak || []} />
            <SeasonGroupSection status="soon" cards={data?.soon || []} />
            <SeasonGroupSection status="upcoming" cards={data?.upcoming || []} />
          </>
        )}
      </div>
    </div>
  );
};

export default SeasonCalendarScreen;
