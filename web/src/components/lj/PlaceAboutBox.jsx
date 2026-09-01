import React, { useEffect, useState } from 'react';
import { LJ } from './tokens';
import { cleanForTwoLines } from './textHelpers';
import { buildInstantPlaceBlurb } from './placeBlurb';
import { fetchPlaceDescription } from '../../api/placeDescription';

const MAX_CHARS = 200;

/**
 * "이곳은 어떤 곳인가요" — 실시간 상태(지금)와 대비되는 장소 자체의 배경 설명.
 * 진입 즉시 로컬 한 줄을 보여 주고, 서버(Claude·월 단위 캐시) 소개가 오면 교체한다.
 */
export function PlaceAboutBox({ placeName, region = '', tags = [] }) {
  const [desc, setDesc] = useState(() =>
    cleanForTwoLines(buildInstantPlaceBlurb(placeName, region), MAX_CHARS),
  );

  useEffect(() => {
    setDesc(cleanForTwoLines(buildInstantPlaceBlurb(placeName, region), MAX_CHARS));
    if (!placeName) return undefined;
    let cancelled = false;
    fetchPlaceDescription({ placeKey: placeName, regionHint: region, tags })
      .then((text) => {
        if (!cancelled && text) setDesc(cleanForTwoLines(text, MAX_CHARS));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // tags는 매 렌더 새 배열이라 의존성에서 제외(장소가 같으면 재호출 불필요)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeName, region]);

  if (!desc) return null;

  return (
    <section style={{ padding: '22px 18px 0', fontFamily: LJ.fontStack }}>
      <div style={{ background: LJ.bgSurface, borderRadius: 12, padding: '14px 14px 15px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: LJ.textSecondary }}>
          이곳은 어떤 곳인가요
        </div>
        <p
          style={{
            margin: '7px 0 0',
            fontSize: 13,
            lineHeight: 1.65,
            color: LJ.textPrimary,
            wordBreak: 'keep-all',
          }}
        >
          {desc}
        </p>
      </div>
    </section>
  );
}

export default PlaceAboutBox;
