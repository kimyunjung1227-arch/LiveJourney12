import React, { useState } from 'react';
import { IconAward } from '@tabler/icons-react';

import honorGold from '../../assets/badges/honor_gold.png';
import honorBronze from '../../assets/badges/honor_bronze.png';
import crown1 from '../../assets/badges/crown_1.png';
import crown5 from '../../assets/badges/crown_5.png';
import crown10 from '../../assets/badges/crown_10.png';
import flame100 from '../../assets/badges/flame_100.png';
import flame300 from '../../assets/badges/flame_300.png';
import flame500 from '../../assets/badges/flame_500.png';
import cherry from '../../assets/badges/cherry.png';
import sunset from '../../assets/badges/sunset.png';
import weather from '../../assets/badges/weather.png';
import festival from '../../assets/badges/festival.png';
import crowd from '../../assets/badges/crowd.png';
import store from '../../assets/badges/store.png';
import seoul from '../../assets/badges/seoul.png';
import jeju from '../../assets/badges/jeju.png';
import busan from '../../assets/badges/busan.png';

const KEY_DARK = '#1A6EA8';
const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const SECTION_LABEL = '#4A7DA8';

/**
 * 라이브저니 뱃지 박스.
 * - 영예 / 베스트 컷 작가 / 도움 마일스톤 / 카테고리 전문성 / 지역 전문성
 * - 보유한 뱃지는 컬러로, 미획득은 흐리게 표시
 */
export default function BadgesBox({ user }) {
  const [active, setActive] = useState(null);
  if (!user) return null;

  const helped = user.helped_count || 0;
  const bestCut = user.best_cut_count || 0;
  const primaryCity = user.primary_city || '';
  const isArtist = !!user.is_best_cut_artist;

  // 카테고리 전문성 카운트 (없으면 0)
  const cherryCount = user.cherry_count || 0;
  const sunsetCount = user.sunset_count || 0;
  const weatherCount = user.weather_count || 0;
  const festivalCount = user.festival_count || 0;
  const crowdCount = user.crowd_count || 0;
  const storeCount = user.store_count || 0;

  // 영예 — 가장 강한 두 종
  const honorRow = [
    {
      img: honorGold,
      name: '영예 (금)',
      desc: '커뮤니티 최상위 기여자',
      earned: helped >= 500 && bestCut >= 10,
    },
    {
      img: honorBronze,
      name: '영예 (동)',
      desc: '꾸준한 기여자',
      earned: helped >= 100 || bestCut >= 1,
    },
  ];

  // 베스트 컷 작가 — 왕관 단계
  const crownRow = [
    { img: crown1, name: '베스트 컷 1회', desc: '첫 번째 베스트 컷', earned: bestCut >= 1 || isArtist },
    { img: crown5, name: '베스트 컷 5회', desc: '5회 베스트 컷 선정', earned: bestCut >= 5 },
    { img: crown10, name: '베스트 컷 10회', desc: '10회 베스트 컷 선정', earned: bestCut >= 10 },
  ];

  // 도움 마일스톤 — 불꽃 단계
  const flameRow = [
    { img: flame100, name: '도움 100명', desc: '100명에게 도움', earned: helped >= 100 },
    { img: flame300, name: '도움 300명', desc: '300명에게 도움', earned: helped >= 300 },
    { img: flame500, name: '도움 500명+', desc: '500명 이상 도움', earned: helped >= 500 },
  ];

  // 카테고리 전문성 (6종)
  const categoryRow = [
    { img: cherry, name: '벚꽃 마스터', desc: '개화·자연 전문', earned: cherryCount >= 10 },
    { img: sunset, name: '노을 헌터', desc: '노을·야경 전문', earned: sunsetCount >= 10 },
    { img: weather, name: '날씨 리포터', desc: '날씨·체감 전문', earned: weatherCount >= 10 },
    { img: festival, name: '축제 마니아', desc: '이벤트·축제 전문', earned: festivalCount >= 10 },
    { img: crowd, name: '인파 리더', desc: '혼잡도·대기 전문', earned: crowdCount >= 10 },
    { img: store, name: '단골 탐험가', desc: '영업·운영 전문', earned: storeCount >= 10 },
  ];

  // 지역 전문성 (3종)
  const regionRow = [
    { img: seoul, name: '서울 토박이', desc: '서울 지역 전문', earned: primaryCity === '서울' },
    { img: jeju, name: '제주 단골', desc: '제주 지역 전문', earned: primaryCity === '제주' },
    { img: busan, name: '부산 탐험가', desc: '부산 지역 전문', earned: primaryCity === '부산' },
  ];

  return (
    <div
      style={{
        margin: '0 18px 14px',
        padding: 16,
        borderRadius: 13,
        background: 'linear-gradient(135deg, #F0F9FE, #FBFDFF)',
        border: '1px solid rgba(77, 184, 232, 0.18)',
      }}
    >
      <div className="flex items-center gap-1.5" style={{ marginBottom: 12 }}>
        <IconAward size={13} color={KEY_DARK} stroke={2.2} />
        <span style={{ fontSize: 12, fontWeight: 700, color: KEY_DARK, letterSpacing: 0.2 }}>
          뱃지
        </span>
      </div>

      <BadgeSection label="영예" items={honorRow} onSelect={setActive} />
      <BadgeSection label="베스트 컷 작가" items={crownRow} onSelect={setActive} />
      <BadgeSection label="도움 마일스톤" items={flameRow} onSelect={setActive} />
      <BadgeSection label="카테고리 전문성" items={categoryRow} onSelect={setActive} />
      <BadgeSection label="지역 전문성" items={regionRow} onSelect={setActive} isLast />

      {active && (
        <div
          role="tooltip"
          style={{
            marginTop: 10,
            padding: '8px 12px',
            borderRadius: 8,
            background: '#fff',
            border: '1px solid rgba(77, 184, 232, 0.25)',
            fontSize: 12,
            color: TEXT_PRIMARY,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <strong style={{ fontWeight: 700 }}>{active.name}</strong>
          <span style={{ color: TEXT_SECONDARY }}>· {active.desc}</span>
          {!active.earned && (
            <span style={{ marginLeft: 'auto', color: TEXT_SECONDARY, fontSize: 11 }}>미획득</span>
          )}
        </div>
      )}
    </div>
  );
}

function BadgeSection({ label, items, onSelect, isLast = false }) {
  return (
    <div style={{ marginBottom: isLast ? 0 : 12 }}>
      <p
        className="m-0"
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: SECTION_LABEL,
          letterSpacing: 0.4,
          marginBottom: 8,
        }}
      >
        {label}
      </p>
      <div className="flex flex-wrap" style={{ gap: 10 }}>
        {items.map((item) => (
          <BadgeChip key={item.name} item={item} onClick={() => onSelect(item)} />
        ))}
      </div>
    </div>
  );
}

function BadgeChip({ item, onClick }) {
  const { img, name, earned } = item;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${name}${earned ? '' : ' (미획득)'}`}
      className="flex items-center justify-center"
      style={{
        width: 46,
        height: 46,
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        opacity: earned ? 1 : 0.28,
        filter: earned ? 'none' : 'grayscale(1)',
      }}
    >
      <img
        src={img}
        alt=""
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </button>
  );
}
