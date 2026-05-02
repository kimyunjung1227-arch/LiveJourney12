/**
 * 지역별 대표 명소/랜드마크 데이터
 * 각 지역의 대표적인 관광지, 명소들을 정의합니다
 */

export const REGION_LANDMARKS = {
  // 부산
  '부산': [
    { id: 'haeundae', name: '해운대', keywords: ['해운대', '해운대해수욕장', '해운대해변'] },
    { id: 'gwanganri', name: '광안리', keywords: ['광안리', '광안리해수욕장', '광안대교'] },
    { id: 'gamcheon', name: '감천문화마을', keywords: ['감천문화마을', '감천'] },
    { id: 'jagalchi', name: '자갈치시장', keywords: ['자갈치', '자갈치시장'] },
    { id: 'taejongdae', name: '태종대', keywords: ['태종대'] },
    { id: 'songdo', name: '송도', keywords: ['송도', '송도해수욕장'] },
    { id: 'yongdusan', name: '용두산공원', keywords: ['용두산', '용두산공원'] },
    { id: 'biff', name: '부산국제영화제거리', keywords: ['BIFF', '부산국제영화제', '영화제거리'] },
  ],

  // 경주
  '경주': [
    { id: 'bulguksa', name: '불국사', keywords: ['불국사'] },
    { id: 'seokguram', name: '석굴암', keywords: ['석굴암'] },
    { id: 'cheomseongdae', name: '첨성대', keywords: ['첨성대'] },
    { id: 'hwangoingdan', name: '황리단길', keywords: ['황리단길', '황리단'] },
    { id: 'woljeonggyo', name: '월정교', keywords: ['월정교'] },
    { id: 'gyeongju', name: '경주역사유적지구', keywords: ['경주역사유적', '역사유적지구', '신라'] },
    { id: 'donggung', name: '동궁과월지', keywords: ['동궁과월지', '안압지'] },
    { id: 'bomun', name: '보문관광단지', keywords: ['보문', '보문단지'] },
    { id: 'daereungwon', name: '대릉원', keywords: ['대릉원'] },
    { id: 'gyeongju_national', name: '경주국립공원', keywords: ['경주국립공원'] },
  ],

  // 서울
  '서울': [
    { id: 'namsan', name: '남산타워', keywords: ['남산', '남산타워', 'N서울타워'] },
    { id: 'gwanghwamun', name: '광화문', keywords: ['광화문', '경복궁', '궁궐'] },
    { id: 'myeongdong', name: '명동', keywords: ['명동'] },
    { id: 'hongdae', name: '홍대', keywords: ['홍대', '홍익대'] },
    { id: 'gangnam', name: '강남', keywords: ['강남'] },
    { id: 'insadong', name: '인사동', keywords: ['인사동'] },
    { id: 'bukchon', name: '북촌한옥마을', keywords: ['북촌', '북촌한옥마을'] },
    { id: 'hanriver', name: '한강', keywords: ['한강', '한강공원'] },
    { id: 'itaewon', name: '이태원', keywords: ['이태원'] },
    { id: 'ddp', name: '동대문', keywords: ['동대문', 'DDP'] },
    { id: 'jamsil', name: '잠실', keywords: ['잠실', '롯데타워'] },
  ],

  // 제주
  '제주': [
    { id: 'jeju', name: '제주시', keywords: ['제주시'] },
    { id: 'seogwipo', name: '서귀포', keywords: ['서귀포', '서귀포시'] },
    { id: 'seongsan', name: '성산일출봉', keywords: ['성산일출봉', '성산'] },
    { id: 'hallasan', name: '한라산', keywords: ['한라산'] },
    { id: 'oreum', name: '오름', keywords: ['오름'] },
    { id: 'dolhareubang', name: '돌하르방', keywords: ['돌하르방'] },
    { id: 'cheonjiyeon', name: '천지연폭포', keywords: ['천지연폭포'] },
    { id: 'hyupjae', name: '협재해수욕장', keywords: ['협재', '협재해수욕장'] },
    { id: 'hamdeok', name: '함덕해수욕장', keywords: ['함덕', '함덕해수욕장'] },
    { id: 'udo', name: '우도', keywords: ['우도'] },
    { id: 'sungsan', name: '성산', keywords: ['성산'] },
  ],

  // 강릉
  '강릉': [
    { id: 'gangneung', name: '강릉시내', keywords: ['강릉', '강릉시내'] },
    { id: 'anjin', name: '안목해변', keywords: ['안목', '안목해변'] },
    { id: 'gyeongpo', name: '경포대', keywords: ['경포대', '경포해변'] },
    { id: 'oseam', name: '오세암', keywords: ['오세암'] },
    { id: 'jungdongjin', name: '정동진', keywords: ['정동진'] },
    { id: 'coffee_street', name: '안목해변커피거리', keywords: ['커피', '카페', '안목'] },
    { id: 'sundubu', name: '순두부', keywords: ['순두부'] },
  ],

  // 전주
  '전주': [
    { id: 'hanok', name: '전주한옥마을', keywords: ['전주한옥마을', '한옥마을', '한옥'] },
    { id: 'jeonju', name: '전주시내', keywords: ['전주', '전주시내'] },
    { id: 'deokjin', name: '덕진공원', keywords: ['덕진공원'] },
    { id: 'bibimbap', name: '비빔밥', keywords: ['비빔밥'] },
    { id: 'kongnamul', name: '콩나물국밥', keywords: ['콩나물국밥'] },
  ],

  // 여수
  '여수': [
    { id: 'yeosu', name: '여수시내', keywords: ['여수', '여수시내'] },
    { id: 'yeosu_night', name: '여수밤바다', keywords: ['여수밤바다', '밤바다'] },
    { id: 'hyangiram', name: '향일암', keywords: ['향일암'] },
    { id: 'odongdo', name: '오동도', keywords: ['오동도'] },
    { id: 'cablecar', name: '케이블카', keywords: ['케이블카'] },
  ],

  // 속초
  '속초': [
    { id: 'sokcho', name: '속초시내', keywords: ['속초', '속초시내'] },
    { id: 'seorak', name: '설악산', keywords: ['설악산'] },
    { id: 'abai', name: '아바이마을', keywords: ['아바이마을'] },
    { id: 'fish_market', name: '속초수산시장', keywords: ['수산시장', '오징어', '회'] },
  ],

  // 인천
  '인천': [
    { id: 'incheon', name: '인천시내', keywords: ['인천', '인천시내'] },
    { id: 'chinatown', name: '차이나타운', keywords: ['차이나타운', '짜장면'] },
    { id: 'songdo', name: '송도', keywords: ['송도', '송도국제도시'] },
    { id: 'ganghwa', name: '강화도', keywords: ['강화도'] },
    { id: 'wolmi', name: '월미도', keywords: ['월미도'] },
    { id: 'incheon_airport', name: '인천공항', keywords: ['인천공항'] },
  ],

  // 대구
  '대구': [
    { id: 'dongseongro', name: '동성로', keywords: ['동성로'] },
    { id: 'kimkwangseok', name: '김광석길', keywords: ['김광석길', '김광석'] },
    { id: 'yaknyeongsi', name: '약령시', keywords: ['약령시', '약령시장'] },
    { id: 'palgongsan', name: '팔공산', keywords: ['팔공산'] },
  ],

  // 광주
  '광주': [
    { id: 'mudeungsan', name: '무등산', keywords: ['무등산'] },
    { id: 'yangdong', name: '양동시장', keywords: ['양동시장', '양동'] },
    { id: 'chungjangro', name: '충장로', keywords: ['충장로'] },
  ],

  // 대전
  '대전': [
    { id: 'expo', name: '엑스포과학공원', keywords: ['엑스포', '과학공원'] },
    { id: 'sungsimdang', name: '성심당', keywords: ['성심당'] },
    { id: 'hanbat', name: '한밭수목원', keywords: ['한밭수목원', '수목원'] },
    { id: 'daecheongho', name: '대청호', keywords: ['대청호', '대청댐'] },
    { id: 'gyejoksan', name: '계족산', keywords: ['계족산'] },
  ],

  // 울산
  '울산': [
    { id: 'daewangam', name: '대왕암공원', keywords: ['대왕암공원', '대왕암'] },
    { id: 'ganjeolgut', name: '간절곶', keywords: ['간절곶'] },
    { id: 'ulsanbridge', name: '울산대교', keywords: ['울산대교'] },
    { id: 'taehwagang', name: '태화강', keywords: ['태화강', '태화강국가정원'] },
  ],

  // 세종
  '세종': [
    { id: 'hosu', name: '호수공원', keywords: ['호수공원'] },
    { id: 'dodam', name: '도담동', keywords: ['도담동'] },
  ],

  // 수원
  '수원': [
    { id: 'hwaseong', name: '화성', keywords: ['화성', '수원화성'] },
    { id: 'hwaseonghaenggung', name: '화성행궁', keywords: ['화성행궁', '행궁'] },
    { id: 'suwon_galbi', name: '수원갈비', keywords: ['수원갈비'] },
  ],

  // 용인
  '용인': [
    { id: 'everland', name: '에버랜드', keywords: ['에버랜드'] },
    { id: 'folkvillage', name: '한국민속촌', keywords: ['한국민속촌', '민속촌'] },
  ],

  // 성남
  '성남': [
    { id: 'pangyo', name: '판교', keywords: ['판교', '판교테크노밸리'] },
  ],

  // 고양
  '고양': [
    { id: 'ilsanlake', name: '일산호수공원', keywords: ['일산호수공원', '호수공원', '일산'] },
    { id: 'kintex', name: '킨텍스', keywords: ['킨텍스', '전시장'] },
  ],

  // 부천
  '부천': [
    { id: 'cartoon', name: '만화박물관', keywords: ['만화박물관', '애니메이션'] },
  ],

  // 포항
  '포항': [
    { id: 'homigot', name: '호미곶', keywords: ['호미곶', '일출'] },
    { id: 'gwamegi', name: '과메기', keywords: ['과메기', '구룡포'] },
    { id: 'guryongpo', name: '구룡포', keywords: ['구룡포'] },
  ],

  // 창원
  '창원': [
    { id: 'jinhae', name: '진해', keywords: ['진해', '벚꽃', '벚꽃축제'] },
    { id: 'jinhae_street', name: '진해거리', keywords: ['진해거리'] },
  ],

  // ─── 이하: 검색/지역상세에 등장하는 모든 지역 (대표명소 전부) ───

  '안양': [
    { id: 'anyangcheon', name: '안양천', keywords: ['안양천'] },
    { id: 'anyang_art', name: '안양예술공원', keywords: ['예술공원'] },
  ],
  '파주': [
    { id: 'heyri', name: '헤이리', keywords: ['헤이리'] },
    { id: 'paju_pub', name: '파주출판단지', keywords: ['출판단지'] },
    { id: 'imjingak', name: '임진각', keywords: ['임진각', 'DMZ'] },
  ],
  '평택': [
    { id: 'pyeongtaek_port', name: '평택항', keywords: ['항구', '평택항'] },
    { id: 'songtan', name: '송탄', keywords: ['송탄'] },
  ],
  '화성': [
    { id: 'yungneung', name: '융건릉', keywords: ['융건릉'] },
    { id: 'yongjusa', name: '용주사', keywords: ['용주사'] },
    { id: 'jebudo', name: '제부도', keywords: ['제부도'] },
  ],
  '김포': [
    { id: 'gimpo_airport', name: '김포공항', keywords: ['김포공항', '공항'] },
    { id: 'aegibong', name: '애기봉', keywords: ['애기봉'] },
  ],
  '광명': [
    { id: 'gwangmyeong_cave', name: '광명동굴', keywords: ['광명동굴', '동굴'] },
  ],
  '이천': [
    { id: 'icheon_ceramic', name: '이천도자기', keywords: ['도자기', '이천'] },
    { id: 'serapia', name: '세라피아', keywords: ['세라피아'] },
  ],
  '양평': [
    { id: 'dumulmeori', name: '두물머리', keywords: ['두물머리'] },
    { id: 'semiwon', name: '세미원', keywords: ['세미원'] },
  ],
  '가평': [
    { id: 'nami', name: '남이섬', keywords: ['남이섬'] },
    { id: 'petit', name: '쁘띠프랑스', keywords: ['쁘띠프랑스'] },
    { id: 'morning', name: '아침고요수목원', keywords: ['아침고요수목원'] },
  ],
  '포천': [
    { id: 'artvalley', name: '아트밸리', keywords: ['아트밸리'] },
    { id: 'herbisland', name: '허브아일랜드', keywords: ['허브아일랜드'] },
    { id: 'sanjung', name: '산정호수', keywords: ['산정호수'] },
  ],
  '춘천': [
    { id: 'dakgalbi', name: '닭갈비거리', keywords: ['닭갈비'] },
    { id: 'soyanggang', name: '소양강', keywords: ['소양강', '호수'] },
    { id: 'skywalk', name: '스카이워크', keywords: ['스카이워크'] },
  ],
  '원주': [
    { id: 'chiak', name: '치악산', keywords: ['치악산'] },
  ],
  '동해': [
    { id: 'chuam', name: '추암', keywords: ['추암'] },
    { id: 'chotdaebawi', name: '촛대바위', keywords: ['촛대바위'] },
  ],
  '태백': [
    { id: 'taebaek', name: '태백산', keywords: ['태백산', '탄광'] },
    { id: 'snow_festival', name: '눈꽃축제', keywords: ['눈꽃축제'] },
  ],
  '삼척': [
    { id: 'hwanseon', name: '환선굴', keywords: ['환선굴'] },
    { id: 'daegum', name: '대금굴', keywords: ['대금굴'] },
  ],
  '평창': [
    { id: 'yongpyong_resort', name: '용평리조트', keywords: ['용평', '스키', '올림픽'] },
  ],
  '양양': [
    { id: 'naksansa', name: '낙산사', keywords: ['낙산사'] },
    { id: 'hajodae', name: '하조대', keywords: ['하조대', '서핑'] },
  ],
  '청주': [
    { id: 'sangdangsanseong', name: '상당산성', keywords: ['상당산성'] },
    { id: 'cheongju_jikji', name: '직지', keywords: ['직지', '인쇄'] },
  ],
  '충주': [
    { id: 'chungjuho', name: '충주호', keywords: ['충주호', '호수'] },
    { id: 'tangeumdae', name: '탄금대', keywords: ['탄금대'] },
  ],
  '제천': [
    { id: 'cheongpungho', name: '청풍호', keywords: ['청풍호'] },
    { id: 'uirimji', name: '의림지', keywords: ['의림지'] },
  ],
  '천안': [
    { id: 'independence', name: '독립기념관', keywords: ['독립기념관'] },
    { id: 'hodu', name: '호두과자', keywords: ['호두과자'] },
  ],
  '아산': [
    { id: 'onyang', name: '온양온천', keywords: ['온양온천', '온천'] },
    { id: 'hyunchungsa', name: '현충사', keywords: ['현충사', '이순신'] },
  ],
  '공주': [
    { id: 'gongsanseong', name: '공산성', keywords: ['공산성'] },
    { id: 'muryeong', name: '무령왕릉', keywords: ['무령왕릉'] },
  ],
  '보령': [
    { id: 'daecheon', name: '대천해수욕장', keywords: ['대천', '해수욕장', '머드', '머드축제'] },
  ],
  '서산': [
    { id: 'ganwolam', name: '간월암', keywords: ['간월암'] },
    { id: 'maae', name: '마애삼존불', keywords: ['마애삼존불', '석불'] },
  ],
  '당진': [
    { id: 'waemok', name: '왜목마을', keywords: ['왜목마을', '일출', '일몰'] },
  ],
  '부여': [
    { id: 'gongnamji', name: '궁남지', keywords: ['궁남지'] },
    { id: 'jeongnimsaji', name: '정림사지', keywords: ['정림사지'] },
  ],
  '군산': [
    { id: 'iseongdang', name: '이성당', keywords: ['이성당', '빵'] },
    { id: 'gyeongam', name: '경암동철길', keywords: ['경암동'] },
  ],
  '익산': [
    { id: 'mireuksaji', name: '미륵사지', keywords: ['미륵사지'] },
  ],
  '정읍': [
    { id: 'naejangsan', name: '내장산', keywords: ['내장산', '단풍'] },
  ],
  '남원': [
    { id: 'gwanghanru', name: '광한루', keywords: ['광한루', '춘향'] },
    { id: 'jirisan', name: '지리산', keywords: ['지리산'] },
  ],
  '목포': [
    { id: 'yudal', name: '유달산', keywords: ['유달산'] },
    { id: 'gatbawi', name: '갓바위', keywords: ['갓바위'] },
  ],
  '순천': [
    { id: 'suncheonman', name: '순천만', keywords: ['순천만', '갈대', '습지'] },
    { id: 'suncheon_garden', name: '순천만정원', keywords: ['정원'] },
  ],
  '광양': [
    { id: 'maehwa', name: '매화', keywords: ['매화', '섬진강'] },
  ],
  '담양': [
    { id: 'juknok', name: '죽녹원', keywords: ['죽녹원', '대나무'] },
    { id: 'metasequoia', name: '메타세쿼이아', keywords: ['메타세쿼이아'] },
  ],
  '보성': [
    { id: 'green_tea', name: '보성녹차밭', keywords: ['녹차', '차밭', '보성'] },
  ],
  '구미': [
    { id: 'gumi_city', name: '구미시내', keywords: ['구미', '구미시내'] },
  ],
  '안동': [
    { id: 'hahoe', name: '하회마을', keywords: ['하회마을', '하회'] },
    { id: 'mask', name: '탈춤', keywords: ['탈춤'] },
    { id: 'anggwa', name: '간고등어', keywords: ['간고등어'] },
  ],
  '김천': [
    { id: 'jikjisa', name: '직지사', keywords: ['직지사'] },
    { id: 'yeonhwaji', name: '연화지', keywords: ['연화지'] },
  ],
  '영주': [
    { id: 'buseoksa', name: '부석사', keywords: ['부석사'] },
    { id: 'sosuseowon', name: '소수서원', keywords: ['소수서원'] },
  ],
  '진주': [
    { id: 'jinjuseong', name: '진주성', keywords: ['진주성'] },
    { id: 'namgang', name: '남강', keywords: ['남강'] },
  ],
  '통영': [
    { id: 'tongyeong_cable', name: '통영케이블카', keywords: ['케이블카'] },
    { id: 'hallyeo', name: '한려수도', keywords: ['한려수도'] },
  ],
  '사천': [
    { id: 'sacheon', name: '사천시', keywords: ['사천', '해변'] },
  ],
  '김해': [
    { id: 'gimhae_airport', name: '김해공항', keywords: ['김해공항', '공항'] },
    { id: 'suro', name: '수로왕릉', keywords: ['수로왕릉', '가야'] },
  ],
  '거제': [
    { id: 'haegumgang', name: '해금강', keywords: ['해금강'] },
    { id: 'oedo', name: '외도', keywords: ['외도'] },
  ],
  '양산': [
    { id: 'tongdosa', name: '통도사', keywords: ['통도사'] },
    { id: 'sinbulsan', name: '신불산', keywords: ['신불산'] },
  ],
  '서귀포': [
    { id: 'jeongbang', name: '정방폭포', keywords: ['정방폭포'] },
    { id: 'cheonjiyeon_s', name: '천지연폭포', keywords: ['천지연', '천지연폭포'] },
    { id: 'seogwipo_city', name: '서귀포시내', keywords: ['서귀포', '서귀포시내'] },
  ],
};

/**
 * 지역명으로 대표 명소 목록 가져오기
 */
export const getLandmarksByRegion = (regionName) => {
  if (!regionName) return [];
  return REGION_LANDMARKS[regionName] || [];
};

/**
 * 명소 ID로 명소 정보 가져오기
 */
export const getLandmarkById = (regionName, landmarkId) => {
  const landmarks = getLandmarksByRegion(regionName);
  return landmarks.find(landmark => landmark.id === landmarkId);
};

/**
 * 게시물이 선택된 명소와 일치하는지 확인
 */
export const isPostMatchingLandmarks = (post, selectedLandmarkIds, regionName) => {
  if (!selectedLandmarkIds || selectedLandmarkIds.length === 0) return true;
  
  const landmarks = getLandmarksByRegion(regionName);
  const selectedLandmarks = landmarks.filter(l => selectedLandmarkIds.includes(l.id));
  
  if (selectedLandmarks.length === 0) return true;
  
  // 게시물의 위치 정보
  const postLocation = (post.detailedLocation || post.placeName || post.location || '').toLowerCase();
  const postTags = (post.tags || []).join(' ').toLowerCase();
  const postNote = (post.note || post.content || '').toLowerCase();
  const searchText = `${postLocation} ${postTags} ${postNote}`;
  
  // 선택된 명소 중 하나라도 키워드와 일치하면 true
  return selectedLandmarks.some(landmark => {
    return landmark.keywords.some(keyword => {
      return searchText.includes(keyword.toLowerCase());
    });
  });
};
