/**
 * 데모용 Mock 업로드 데이터 생성
 * (서버 운영 전환) localStorage 제거 → mock 데이터 저장/복원 기능 비활성화
 */

// 샘플 이미지 URL (Unsplash 무료 이미지 - 한국 배경)
const sampleImages = {
  // 🌸 개화 상황 (bloom) - 한국 지역 꽃/벚꽃 사진
  bloom: [
    // 서울 여의도 윤중로 벚꽃
    'https://images.unsplash.com/photo-1526481280695-3c687fd543c0?w=800',
    // 경주 보문단지 벚꽃 느낌
    'https://images.unsplash.com/photo-1526481280695-3c687fd543c0?w=800&sat=-20&hue=10',
    // 전주 한옥마을 골목 꽃길
    'https://images.unsplash.com/photo-1514222134-b57cbb8ce073?w=800',
    // 부산 수변공원/광안리 근처 꽃길
    'https://images.unsplash.com/photo-1526481280695-3c687fd543c0?w=800&crop=faces&fit=crop',
    // 제주 유채꽃/동백꽃 느낌
    'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800',
    // 강릉/속초 봄바다와 꽃
    'https://images.unsplash.com/photo-1519129560278-aa6b4e57bb60?w=800&sat=10',
  ],
  
  // 🏞️ 랜드마크/풍경 (landmark, scenic)
  landmark: [
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800', // 경복궁
    'https://images.unsplash.com/photo-1514890547357-a9ee288728e0?w=800', // 한라산
    'https://images.unsplash.com/photo-1545243424-0ce743321e11?w=800', // 부산 광안대교
    'https://images.unsplash.com/photo-1519129560278-aa6b4e57bb60?w=800', // 남산타워
    'https://images.unsplash.com/photo-1524222717473-730000096953?w=800', // 서울 스카이라인
    'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800', // 제주 바다
  ],
  
  // 🍜 맛집 정보 (food)
  food: [
    'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=800', // 한식 식탁
    'https://images.unsplash.com/photo-1550305080-4e029753abcf?w=800', // 한국 길거리 음식
    'https://images.unsplash.com/photo-1550305080-4e029753abcf?w=800',
    'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=800', // 한국식 고기구이
    'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800',   // 비빔밥/한식
    'https://images.unsplash.com/photo-1604908176997-1251884b08a3?w=800', // 떡볶이
  ],
};

// 한국 주요 지역 (62개) - 서울은 통합!
const regions = [
  // 특별시/광역시
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  
  // 경기도
  '수원', '용인', '성남', '고양', '부천', '안양', '파주', '평택', '화성', '김포', '광명', '이천', '양평', '가평', '포천',
  
  // 강원도
  '춘천', '강릉', '속초', '원주', '동해', '태백', '삼척', '평창', '양양',
  
  // 충청도
  '청주', '충주', '제천', '천안', '아산', '공주', '논산', '보령',
  
  // 경상도
  '포항', '경주', '구미', '안동', '울진', '창원', '진주', '통영', '사천', '거제', '김해', '양산',
  
  // 전라도
  '전주', '익산', '군산', '목포', '여수', '순천', '광양', '나주', '무안', '담양',
  
  // 제주도
  '제주'
];

// 지역별 상세 장소 정보
const detailedLocations = {
  bloom: {
    // 특별시/광역시
    '서울': ['경복궁 벚꽃길', '여의도 윤중로', '석촌호수 벚꽃', '남산 벚꽃터널', '창경궁 봄꽃'],
    
    // 서울 각 구
    '강남구': ['양재천 벚꽃', '선릉 봄꽃', '봉은사 벚꽃', '대치동 은행나무길'],
    '서초구': ['반포 한강공원 유채꽃', '서리풀공원 벚꽃', '양재천 벚꽃'],
    '송파구': ['석촌호수 벚꽃', '올림픽공원 개나리', '방이동 벚꽃'],
    '강동구': ['고덕산 진달래', '일자산 벚꽃', '강동그린웨이'],
    '마포구': ['망원한강공원 유채꽃', '월드컵공원 억새', '경의선숲길 벚꽃'],
    '용산구': ['용산가족공원 벚꽃', '이촌한강공원 벚꽃', '전쟁기념관 벚꽃'],
    '성동구': ['서울숲 벚꽃', '응봉산 진달래', '중랑천 벚꽃'],
    '광진구': ['광나루한강공원 유채꽃', '어린이대공원 벚꽃', '중곡동 벚꽃'],
    '종로구': ['창경궁 봄꽃', '북촌 벚꽃', '삼청동 벚꽃길'],
    '중구': ['남산 벚꽃터널', '덕수궁 봄꽃', '을지로 가로수길'],
    '영등포구': ['여의도 윤중로', '영등포공원 벚꽃', '당산역 벚꽃'],
    '구로구': ['온수역 벚꽃', '안양천 벚꽃', '구로공원 봄꽃'],
    '강서구': ['강서한강공원 유채꽃', '우장산 진달래', '봉제산 벚꽃'],
    '양천구': ['신정동 벚꽃길', '목동공원 벚꽃', '안양천 봄꽃'],
    '관악구': ['낙성대공원 벚꽃', '관악산 진달래', '봉천동 벚꽃'],
    '동작구': ['여의도 샛강 벚꽃', '보라매공원 벚꽃', '사당동 벚꽃'],
    '성북구': ['성북천 벚꽃', '북악산 진달래', '성북동 벚꽃길'],
    '강북구': ['북한산 진달래', '우이천 벚꽃', '솔밭공원 봄꽃'],
    '도봉구': ['도봉산 진달래', '방학천 벚꽃', '쌍문동 벚꽃'],
    '노원구': ['불암산 진달래', '중랑천 벚꽃', '상계동 벚꽃'],
    '은평구': ['북한산 진달래', '불광천 벚꽃', '연신내 은행나무'],
    '서대문구': ['안산 진달래', '독립공원 벚꽃', '연희동 벚꽃'],
    '동대문구': ['청량리 벚꽃', '중랑천 벚꽃', '배봉산 진달래'],
    '중랑구': ['용마산 진달래', '중랑천 벚꽃', '망우산 봄꽃'],
    '금천구': ['시흥동 벚꽃', '금천구청 벚꽃', '독산동 봄꽃'],
    '부산': ['삼광사 벚꽃', '황령산 벚꽃길', '대저생태공원 유채꽃', '온천천 벚꽃'],
    '대구': ['이월드 벚꽃', '앞산 벚꽃길', '동촌유원지', '수성못 벚꽃'],
    '인천': ['인천대공원 벚꽃', '송도 센트럴파크', '자유공원 벚꽃', '월미공원'],
    '광주': ['무등산 봄꽃', '광주호 호수공원', '금남로 벚꽃', '양림동 꽃길'],
    '대전': ['대전 엑스포 벚꽃', '한밭수목원', '대청호 벚꽃', '계족산 봄꽃'],
    '울산': ['태화강 벚꽃', '간절곶 유채꽃', '울산대공원 벚꽃', '십리대숲'],
    '세종': ['세종호수공원 벚꽃', '베어트리공원', '금강수목원 봄꽃'],
    
    // 경기도
    '수원': ['수원 화성 벚꽃', '광교호수공원', '수원천 벚꽃', '효원공원'],
    '용인': ['에버랜드 튤립축제', '용인자연휴양림', '농촌테마파크 봄꽃'],
    '성남': ['탄천 벚꽃길', '중앙공원 벚꽃', '율동공원 봄꽃'],
    '고양': ['일산호수공원 벚꽃', '고양 꽃축제', '한강 벚꽃'],
    '부천': ['부천 중앙공원', '상동호수공원 벚꽃'],
    '안양': ['안양천 벚꽃', '평촌공원 봄꽃'],
    '파주': ['임진각 벚꽃', '헤이리 봄꽃', '율곡수목원'],
    '평택': ['평택호 벚꽃', '소사벌 유채꽃'],
    '화성': ['융건릉 벚꽃', '우음도 봄꽃'],
    '김포': ['김포 한강 벚꽃', '문수산 봄꽃'],
    '광명': ['광명동굴 앞 벚꽃'],
    '이천': ['설봉공원 벚꽃', '이천 도자기 마을'],
    '양평': ['두물머리 벚꽃', '세미원 연꽃', '용문산 봄꽃'],
    '가평': ['남이섬 벚꽃', '아침고요수목원', '자라섬 봄꽃'],
    '포천': ['산정호수 벚꽃', '허브아일랜드 봄꽃'],
    
    // 강원도
    '춘천': ['의암호 벚꽃', '소양강 봄꽃', '춘천 김유정역'],
    '강릉': ['경포대 벚꽃', '강릉 솔향수목원', '오죽헌 벚꽃', '안목 벚꽃'],
    '속초': ['영금정 해안', '속초 청초호', '설악산 봄꽃', '대포항 벚꽃'],
    '원주': ['치악산 봄꽃', '섬강 벚꽃'],
    '동해': ['무릉계곡 봄꽃', '추암 벚꽃'],
    '태백': ['태백산 철쭉', '검룡소 봄꽃'],
    '삼척': ['환선굴 앞 벚꽃', '죽서루 봄꽃'],
    '평창': ['대관령 양떼목장', '월정사 전나무숲'],
    '양양': ['하조대 벚꽃', '낙산사 봄꽃'],
    
    // 충청도
    '청주': ['무심천 벚꽃', '상당산성 봄꽃'],
    '충주': ['충주호 벚꽃', '탄금대 봄꽃'],
    '제천': ['청풍호 벚꽃', '의림지 벚꽃'],
    '천안': ['독립기념관 벚꽃', '각원사 봄꽃'],
    '아산': ['현충사 벚꽃', '아산 온천 벚꽃'],
    '공주': ['공산성 벚꽃', '무령왕릉 봄꽃'],
    '논산': ['탑정호 벚꽃', '관촉사 봄꽃'],
    '보령': ['대천해수욕장 벚꽃', '무창포 봄꽃'],
    
    // 경상도
    '포항': ['형산강 벚꽃', '호미곶 봄꽃', '영일대 벚꽃'],
    '경주': ['보문단지 벚꽃', '불국사 봄꽃', '경주 벚꽃마라톤', '대릉원 봄꽃'],
    '구미': ['금오산 봄꽃', '낙동강 벚꽃'],
    '안동': ['하회마을 봄꽃', '도산서원 벚꽃', '봉정사 벚꽃'],
    '울진': ['왕피천 봄꽃', '불영사 벚꽃'],
    '창원': ['진해 벚꽃축제', '여좌천 벚꽃', '경화역 벚꽃'],
    '진주': ['진양호 벚꽃', '진주성 봄꽃'],
    '통영': ['통영 벚꽃', '미륵산 봄꽃'],
    '사천': ['사천해변 봄꽃', '실안낙조 벚꽃'],
    '거제': ['거제 학동 벚꽃', '바람의 언덕'],
    '김해': ['김해 가야테마파크', '화포천 벚꽃'],
    '양산': ['통도사 봄꽃', '황산공원 벚꽃'],
    
    // 전라도
    '전주': ['전주 덕진공원', '전주천 벚꽃', '한옥마을 벚꽃', '완산칠봉'],
    '익산': ['미륵사지 봄꽃', '익산 보석박물관'],
    '군산': ['경암동 철길마을', '군산 벚꽃'],
    '목포': ['유달산 벚꽃', '평화광장 봄꽃'],
    '여수': ['여수 향일암', '여수 오동도', '여수 봄꽃축제', '돌산 봄꽃'],
    '순천': ['순천만 봄꽃', '순천만정원 봄축제'],
    '광양': ['광양 매화축제', '백운산 봄꽃'],
    '나주': ['나주 영산포', '나주호 벚꽃'],
    '무안': ['회산백련지 연꽃', '무안 갯벌'],
    '담양': ['죽녹원 대나무', '메타세쿼이아길'],
    
    // 제주도
    '제주': ['제주 왕벚꽃', '녹산로 유채꽃', '한림공원 수국', '제주 벚꽃축제', '한라산 봄꽃']
  },
  landmark: {
    // 특별시/광역시
    '서울': ['경복궁', 'N서울타워', '광화문광장', '청계천', '북촌한옥마을', '덕수궁'],
    
    // 서울 각 구
    '강남구': ['코엑스', '봉은사', '선정릉', '강남역 거리', '테헤란로'],
    '서초구': ['국립중앙도서관', '예술의전당', '서래마을', '양재시민의숲'],
    '송파구': ['롯데월드타워', '올림픽공원', '석촌호수', '방이동 고분군'],
    '강동구': ['암사동 선사유적지', '일자산', '천호공원'],
    '마포구': ['홍대거리', '망원시장', '경의선숲길', '월드컵공원'],
    '용산구': ['용산 전쟁기념관', '국립중앙박물관', '남산', '이태원 거리'],
    '성동구': ['서울숲', '성수 카페거리', '뚝섬한강공원'],
    '광진구': ['어린이대공원', '건대 맛집거리', '광나루한강공원'],
    '종로구': ['경복궁', '인사동', '창덕궁', '북촌한옥마을', '삼청동'],
    '중구': ['명동', '남대문시장', 'N서울타워', '덕수궁', '청계천'],
    '영등포구': ['여의도 한강공원', '63빌딩', '타임스퀘어', '영등포시장'],
    '구로구': ['구로디지털단지', '온수역', '항동철길'],
    '강서구': ['마곡 서울식물원', '우장산', '개화산'],
    '양천구': ['목동 아이스링크', '신정동 카페거리', '오목교역'],
    '관악구': ['관악산', '서울대학교', '낙성대공원'],
    '동작구': ['보라매공원', '노량진 수산시장', '사당역'],
    '성북구': ['성북동 한옥마을', '북악스카이웨이', '정릉계곡'],
    '강북구': ['북한산', '우이동 계곡', '4.19 민주묘지'],
    '도봉구': ['도봉산', '쌍문역', '방학동 은행나무길'],
    '노원구': ['불암산', '중계본동 은행나무길', '태릉'],
    '은평구': ['북한산', '연신내 먹자골목', '불광천'],
    '서대문구': ['안산', '독립문', '연희동 카페거리'],
    '동대문구': ['동대문디자인플라자', '청량리 전통시장', '배봉산'],
    '중랑구': ['용마폭포공원', '봉화산', '중랑천'],
    '금천구': ['금천구청', '시흥사거리', '독산동'],
    '부산': ['해운대 해수욕장', '광안대교', '감천문화마을', '태종대', '용두산공원'],
    '대구': ['팔공산', '동화사', '이월드', '김광석 거리', '서문시장'],
    '인천': ['송도 센트럴파크', '월미도', '차이나타운', '인천대교', '강화도'],
    '광주': ['무등산', '금남로', '양림동 역사문화마을', '국립아시아문화전당', '518민주광장'],
    '대전': ['엑스포과학공원', '한밭수목원', '계룡산', '대청댐', '유성온천'],
    '울산': ['태화강', '간절곶', '대왕암공원', '울산대공원', '반구대 암각화'],
    '세종': ['세종호수공원', '국립세종수목원', '금강수목원'],
    
    // 경기도
    '수원': ['화성행궁', '수원화성', '행리단길', '광교호수공원', '화성 성곽'],
    '용인': ['에버랜드', '한국민속촌', '호암미술관', 'MBC 드라미아'],
    '성남': ['판교 테크노밸리', '분당 정자동 카페거리', '모란시장'],
    '고양': ['일산 호수공원', '킨텍스', '원마운트', '고양 스타필드'],
    '부천': ['부천 만화박물관', '부천 필하모닉 오케스트라', '부천 중앙공원'],
    '안양': ['안양 예술공원', '안양천', '병목안 시민공원'],
    '파주': ['헤이리 예술마을', '출판도시', '임진각', 'DMZ'],
    '평택': ['평택호 관광단지', '평택항', '평택 소사벌'],
    '화성': ['융건릉', '용주사', '제부도', '전곡항'],
    '김포': ['김포 한강 신도시', '대명항', '애기봉'],
    '광명': ['광명동굴', 'KTX 광명역', '광명 전통시장'],
    '이천': ['이천 도자기 마을', '설봉공원', '산수유마을'],
    '양평': ['두물머리', '세미원', '용문산', '양평 레일바이크'],
    '가평': ['남이섬', '쁘띠프랑스', '아침고요수목원', '자라섬'],
    '포천': ['아트밸리', '허브아일랜드', '산정호수', '백운계곡'],
    
    // 강원도
    '춘천': ['남이섬', '소양강 스카이워크', '춘천 명동거리', '김유정문학촌'],
    '강릉': ['경포해변', '안목해변', '정동진', '오죽헌', '선교장'],
    '속초': ['설악산', '속초해수욕장', '청초호', '아바이마을', '속초 중앙시장'],
    '원주': ['치악산', '뮤지엄 산', '간현관광지'],
    '동해': ['무릉계곡', '추암 촛대바위', '망상해변'],
    '태백': ['태백산', '황지연못', '태백석탄박물관'],
    '삼척': ['환선굴', '대금굴', '해신당공원', '죽서루'],
    '평창': ['대관령', '월정사', '알펜시아', '오대산'],
    '양양': ['낙산사', '하조대', '서피비치', '양양 송이축제'],
    
    // 충청도
    '청주': ['상당산성', '청주 고인쇄박물관', '문의문화재단지'],
    '충주': ['충주호', '탄금대', '중원탑평리칠층석탑'],
    '제천': ['청풍문화재단지', '의림지', '월악산'],
    '천안': ['독립기념관', '각원사', '천안 삼거리공원'],
    '아산': ['현충사', '외암민속마을', '아산 온천'],
    '공주': ['공산성', '무령왕릉', '송산리 고분군', '공주 한옥마을'],
    '논산': ['관촉사', '탑정호', '논산 딸기축제'],
    '보령': ['대천해수욕장', '무창포', '보령 머드축제'],
    
    // 경상도
    '포항': ['호미곶', '영일대 해수욕장', '형산강', '포스코'],
    '경주': ['불국사', '석굴암', '첨성대', '안압지', '대릉원', '양동마을'],
    '구미': ['금오산', '도개면 한밤마을', '낙동강 체육공원'],
    '안동': ['하회마을', '병산서원', '도산서원', '봉정사', '안동 구시장'],
    '울진': ['불영사', '성류굴', '왕피천', '울진대게'],
    '창원': ['진해 군항제', '창원 용지호수공원', '마산 어시장'],
    '진주': ['진주성', '촉석루', '진주 남강', '진주성 야경'],
    '통영': ['동피랑', '케이블카', '통영대교', '이순신공원'],
    '사천': ['삼천포대교', '초양도', '실안낙조'],
    '거제': ['해금강', '바람의 언덕', '외도 보타니아', '거제 포로수용소'],
    '김해': ['김해 가야테마파크', '수로왕릉', '김해천문대'],
    '양산': ['통도사', '황산공원', '양산타워'],
    
    // 전라도
    '전주': ['전주한옥마을', '경기전', '오목대', '전동성당', '풍남문'],
    '익산': ['미륵사지', '왕궁리 유적', '익산 보석박물관'],
    '군산': ['경암동 철길마을', '군산 근대역사박물관', '채만식문학관'],
    '목포': ['유달산', '평화광장', '목포 해상케이블카', '근대역사관'],
    '여수': ['향일암', '오동도', '여수밤바다', '돌산대교', '여수 엑스포'],
    '순천': ['순천만', '순천만정원', '낙안읍성', '드라마세트장'],
    '광양': ['광양 백운산', '광양제철소', '섬진강'],
    '나주': ['나주 영산포', '금성관', '나주 혁신도시'],
    '무안': ['무안 국제공항', '회산백련지'],
    '담양': ['죽녹원', '메타세쿼이아길', '가사문학관', '관방제림'],
    
    // 제주도
    '제주': ['성산일출봉', '한라산', '우도', '섭지코지', '주상절리', '만장굴']
  },
  food: {
    // 특별시/광역시
    '서울': ['명동교자 명동점', '광장시장 육회', '이태원 경양식', '강남 삼겹살', '을지로 곱창', '마포 족발'],
    
    // 서울 각 구
    '강남구': ['강남 삼겹살', '신사동 가로수길 카페', '압구정 맛집', '청담동 한정식'],
    '서초구': ['서초 한정식', '방배동 카페', '서래마을 프렌치'],
    '송파구': ['잠실 맛집', '석촌 호수 카페', '송리단길 맛집'],
    '강동구': ['천호 맛집', '길동 카페', '고덕 맛집'],
    '마포구': ['마포 족발', '홍대 맛집', '연남동 카페', '망원시장 떡볶이'],
    '용산구': ['이태원 경양식', '한남동 맛집', '해방촌 카페', '용리단길'],
    '성동구': ['성수 카페', '왕십리 맛집', '성수동 수제버거'],
    '광진구': ['건대 맛집', '구의동 카페', '광진 중곡동 맛집'],
    '종로구': ['종로 곱창', '삼청동 카페', '인사동 전통찻집', '북촌 한정식'],
    '중구': ['명동교자', '을지로 곱창', '중구 칼국수', '남대문 만두'],
    '영등포구': ['영등포 맛집', '여의도 카페', '당산동 맛집'],
    '구로구': ['구로 맛집', '신도림 떡볶이', '개봉동 중국집'],
    '강서구': ['마곡 맛집', '염창동 카페', '강서 칼국수'],
    '양천구': ['목동 맛집', '신정동 카페', '오목교 맛집'],
    '관악구': ['신림동 순대', '봉천동 맛집', '서울대 맛집'],
    '동작구': ['사당동 맛집', '노량진 초밥', '흑석동 카페'],
    '성북구': ['성북동 맛집', '정릉 카페', '길음동 맛집'],
    '강북구': ['수유리 맛집', '미아동 카페', '강북 맛집'],
    '도봉구': ['쌍문동 맛집', '방학동 카페', '도봉 맛집'],
    '노원구': ['상계동 맛집', '중계동 카페', '하계동 맛집'],
    '은평구': ['연신내 먹자골목', '불광동 맛집', '응암동 카페'],
    '서대문구': ['신촌 맛집', '연희동 카페', '홍제동 맛집'],
    '동대문구': ['청량리 맛집', '회기동 카페', '장안동 맛집'],
    '중랑구': ['면목동 맛집', '상봉동 카페', '중화동 맛집'],
    '금천구': ['독산동 맛집', '시흥동 카페', '금천 맛집'],
    '부산': ['해운대 회센터', '남포동 씨앗호떡', '동래 파전', '부산 밀면', '기장 대게'],
    '대구': ['동인동 찜갈비', '대구 막창', '동성로 카페', '근대골목 빵집'],
    '인천': ['신포 닭강정', '차이나타운 짜장면', '소래포구 회', '연안부두'],
    '광주': ['광주 오리탕', '무등산 보리밥', '양동시장', '충장로 먹거리'],
    '대전': ['성심당 빵', '대전 칼국수', '대전 돈까스', '한밭수목원 카페'],
    '울산': ['울산 고래고기', '태화강 카페', '울산 곱창', '언양불고기'],
    '세종': ['세종 한정식', '세종 카페거리', '세종 맛집'],
    
    // 경기도
    '수원': ['수원 왕갈비', '행리단길 카페', '수원 통닭', '화성행궁 한정식'],
    '용인': ['용인 막국수', '에버랜드 맛집', '용인 카페'],
    '성남': ['판교 맛집', '분당 카페', '모란시장 순대'],
    '고양': ['일산 맛집', '일산 카페', '킨텍스 맛집'],
    '부천': ['부천 중국집', '부천 떡볶이', '부천 맛집'],
    '안양': ['안양 갈비', '평촌 카페', '안양 맛집'],
    '파주': ['파주 갈비', '헤이리 카페', '파주 맛집'],
    '평택': ['평택 한우', '평택 맛집'],
    '화성': ['화성 맛집', '융건릉 한정식'],
    '김포': ['김포 맛집', '김포 한강 카페'],
    '광명': ['광명 맛집', '광명 카페'],
    '이천': ['이천 쌀밥', '이천 도자기 카페', '이천 맛집'],
    '양평': ['양평 한정식', '두물머리 카페', '양평 맛집'],
    '가평': ['가평 닭갈비', '남이섬 맛집', '가평 막국수'],
    '포천': ['포천 이동갈비', '포천 막걸리', '포천 맛집'],
    
    // 강원도
    '춘천': ['춘천 닭갈비', '소양강 카페', '춘천 막국수'],
    '강릉': ['강릉 초당순두부', '강릉 커피거리', '강릉 짬뽕', '안목 카페거리'],
    '속초': ['속초 중앙시장', '아바이순대', '속초 물회', '닭강정'],
    '원주': ['원주 치악산 맛집', '원주 한정식'],
    '동해': ['동해 물회', '동해 카페'],
    '태백': ['태백 황태구이', '태백 맛집'],
    '삼척': ['삼척 물회', '삼척 해산물'],
    '평창': ['평창 한우', '대관령 맛집'],
    '양양': ['양양 서핑 카페', '양양 송이버섯'],
    
    // 충청도
    '청주': ['청주 육회', '청주 한정식', '상당산성 맛집'],
    '충주': ['충주 사과', '충주 맛집'],
    '제천': ['제천 약초요리', '제천 맛집'],
    '천안': ['천안 호두과자', '병천 순대', '천안 맛집'],
    '아산': ['아산 온천 맛집', '아산 한정식'],
    '공주': ['공주 밤', '공주 한정식', '공주 맛집'],
    '논산': ['논산 딸기', '논산 맛집'],
    '보령': ['보령 해산물', '대천 해수욕장 맛집'],
    
    // 경상도
    '포항': ['포항 과메기', '포항 물회', '포항 맛집'],
    '경주': ['경주 쌈밥', '황남빵', '경주 한정식', '경주빵'],
    '구미': ['구미 한정식', '구미 맛집'],
    '안동': ['안동 찜닭', '안동 간고등어', '헛제사밥', '안동소주'],
    '울진': ['울진 대게', '울진 해산물'],
    '창원': ['창원 돼지국밥', '마산 아구찜', '진해 맛집'],
    '진주': ['진주 비빔밥', '진주 냉면', '진주 맛집'],
    '통영': ['통영 굴', '통영 해산물', '동피랑 맛집'],
    '사천': ['사천 항공 맛집', '사천 해산물'],
    '거제': ['거제 해산물', '거제 횟집'],
    '김해': ['김해 국밥', '김해 맛집'],
    '양산': ['양산 맛집', '통도사 한정식'],
    
    // 전라도
    '전주': ['전주비빔밥', '한옥마을 콩나물국밥', '전주 막걸리', '남부시장'],
    '익산': ['익산 보석박물관 카페', '익산 맛집'],
    '군산': ['군산 짬뽕', '이성당 빵', '군산 맛집'],
    '목포': ['목포 홍어', '목포 갈치', '목포 맛집'],
    '여수': ['여수 장어', '돌산 갓김치', '여수 게장백반', '서대회'],
    '순천': ['순천 정원 카페', '순천 한정식', '낙안읍성 맛집'],
    '광양': ['광양 불고기', '광양 맛집'],
    '나주': ['나주 곰탕', '나주 맛집'],
    '무안': ['무안 양파', '무안 맛집'],
    '담양': ['담양 죽순', '메타세쿼이아 카페', '담양 떡갈비'],
    
    // 제주도
    '제주': ['제주 흑돼지', '고기국수 맛집', '제주 해산물', '성산 해녀밥상', '올레국수']
  }
};

// 시간대별 라벨
const timeLabels = [
  '방금', '5분 전', '10분 전', '30분 전',
  '1시간 전', '2시간 전', '3시간 전', '5시간 전',
  '오늘 오전', '오늘 오후', '어제', '2일 전'
];

// 개화 상황 AI 라벨
const bloomLabels = [
  { name: 'Cherry Blossom', confidence: 0.95 },
  { name: 'Flower', confidence: 0.92 },
  { name: 'Spring', confidence: 0.88 },
  { name: 'Pink', confidence: 0.85 },
  { name: 'Nature', confidence: 0.82 }
];

// 랜드마크 AI 라벨
const landmarkLabels = [
  { name: 'Landmark', confidence: 0.94 },
  { name: 'Architecture', confidence: 0.91 },
  { name: 'Tourist Attraction', confidence: 0.89 },
  { name: 'Building', confidence: 0.86 },
  { name: 'Historic Site', confidence: 0.83 }
];

// 맛집 AI 라벨
const foodLabels = [
  { name: 'Food', confidence: 0.96 },
  { name: 'Korean Food', confidence: 0.93 },
  { name: 'Dish', confidence: 0.90 },
  { name: 'Meal', confidence: 0.87 },
  { name: 'Restaurant', confidence: 0.84 }
];

// 카테고리 정보
const categoryInfo = {
  bloom: {
    name: '개화 상황',
    labels: bloomLabels,
    tags: ['#벚꽃', '#봄', '#꽃구경', '#개화']
  },
  landmark: {
    name: '추천 장소',
    labels: landmarkLabels,
    tags: ['#관광', '#여행', '#명소', '#풍경']
  },
  food: {
    name: '맛집 정보',
    labels: foodLabels,
    tags: ['#맛집', '#한식', '#먹스타그램', '#음식']
  }
};

// 랜덤 선택 헬퍼
const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

// 다양한 개인 노트 템플릿
const personalNotes = {
  bloom: [
    "드디어 만개했어요! 올해 꽃이 정말 예쁘게 폈네요. 주말에 오시면 최고의 풍경을 볼 수 있을 것 같아요 🌸",
    "아직 30% 정도 개화했어요. 다음 주쯤이면 만개할 것 같습니다. 사람이 적을 때 오시길 추천드려요!",
    "벚꽃이 정말 아름답습니다! 가족들과 함께 왔는데 모두 감탄했어요. 주차는 조금 불편했지만 그만한 가치가 있어요 ✨",
    "꽃잎이 떨어지기 시작했어요. 꽃비가 정말 낭만적이에요! 서둘러 오시면 아직 충분히 예쁜 모습을 볼 수 있어요 🌸",
    "개화율 70% 정도! 내일모레쯤 만개할 것 같아요. 날씨도 화창해서 사진 찍기 최고예요 📸",
    "이른 아침에 왔더니 사람도 적고 정말 좋았어요. 해뜨는 모습과 함께 보는 꽃이 환상적이었습니다!",
    "지금이 절정! 주말이라 사람이 많지만 그래도 꼭 보러 오세요. 평생 기억에 남을 것 같아요 💕"
  ],
  landmark: [
    "생각보다 훨씬 멋있어요! 사진으로만 보다가 직접 오니 감동이 배가 되네요. 꼭 한 번 방문해보세요 🏞️",
    "입장료가 조금 있지만 충분히 가치가 있어요. 특히 전망대에서 보는 뷰가 정말 끝내줍니다!",
    "가족 여행으로 왔는데 아이들도 너무 좋아했어요. 주변에 편의시설도 잘 되어있고 산책하기 좋아요 ✨",
    "일출 보러 왔는데 정말 감동적이었어요. 새벽부터 많은 사람들이 와있더라고요. 추천합니다! 🌅",
    "날씨 좋을 때 꼭 오세요! 흐린 날은 뷰가 잘 안 보여요. 저는 운 좋게 맑은 날 와서 최고의 경험했습니다.",
    "사진 찍기 좋은 포토존이 많아요! SNS용 사진 건지러 왔는데 대만족이에요 📸",
    "주차장이 조금 작아요. 일찍 오시거나 대중교통 이용을 추천드려요. 그 외엔 모든 게 완벽했습니다!",
    "야경이 정말 아름다워요! 낮과는 또 다른 매력이 있어요. 저녁 6시 이후 방문 강추합니다 🌃"
  ],
  food: [
    "맛집 인정! 웨이팅 30분 했는데 충분히 기다릴 가치가 있어요. 시그니처 메뉴 꼭 드세요 🍜",
    "현지인 추천으로 왔는데 진짜 맛있어요! 양도 푸짐하고 가격도 합리적이에요. 재방문 의사 100%!",
    "SNS에서 보고 왔는데 기대 이상이었어요. 분위기도 좋고 음식 맛도 훌륭해요 ✨",
    "가성비 최고! 이 가격에 이 맛이라니 믿기지 않아요. 동네 맛집으로 강력 추천드립니다 👍",
    "주말엔 웨이팅 필수예요. 평일 점심 시간대 추천드려요. 음식 맛은 정말 일품입니다!",
    "사진으로 보는 것보다 실제가 더 맛있어요! 특히 시그니처 메뉴는 꼭 드셔보세요 🌟",
    "분위기 좋고 음식도 맛있어요. 데이트 코스로 딱이에요! 저녁엔 웨이팅 있으니 예약하시는 게 좋아요 💑",
    "현지인만 안다는 맛집! 관광객은 별로 없고 현지 분들이 많아요. 진짜 맛집의 증거죠 😋"
  ]
};

// 다양한 질문 템플릿
const sampleQuestions = [
  "지금도 사람 많나요?",
  "주차는 어디에 하셨나요?",
  "아이들과 함께 가도 괜찮을까요?",
  "입장료가 얼마인가요?",
  "지금 날씨 어때요?",
  "근처에 식당 있나요?",
  "대중교통으로 가기 편한가요?",
  "사진 찍기 좋은 곳 추천해주세요!",
  "혼자 가도 괜찮을까요?",
  "영업시간이 어떻게 되나요?",
  "예약이 필요한가요?",
  "애완동물 동반 가능한가요?",
  "주변에 볼거리 더 있나요?",
  "몇 시쯤 가는 게 좋을까요?",
  "비 오는 날도 갈 만한가요?"
];

// 다양한 답변 템플릿
const sampleAnswers = [
  "네, 지금은 사람이 많지 않아요. 평일이라 한산한 편입니다!",
  "무료 주차장이 있어요. 약 50대 정도 주차 가능합니다.",
  "아이들 데리고 오기 정말 좋아요! 안전하고 볼거리도 많아요 😊",
  "성인 5,000원, 어린이 3,000원이에요. 가성비 좋습니다!",
  "지금 화창하고 따뜻해요. 방문하기 딱 좋은 날씨네요 ☀️",
  "도보 5분 거리에 맛집 거리가 있어요. 추천드려요!",
  "지하철역에서 도보 10분이에요. 접근성 좋습니다!",
  "전망대와 포토존이 최고예요! 꼭 가보세요 📸",
  "혼자 오신 분들도 많아요. 조용히 즐기기 좋습니다!",
  "오전 9시부터 오후 6시까지예요. 마감 1시간 전까지 입장 가능해요.",
  "평일은 예약 필요 없고, 주말은 예약 추천드려요!",
  "소형견은 가능해요. 대형견은 확인해보시는 게 좋을 것 같아요 🐕",
  "근처에 산책로와 카페들이 많아요. 반나절 코스로 좋아요!",
  "일출/일몰 시간대가 가장 예쁘더라고요! 오전 일찍이나 저녁 추천드려요 🌅",
  "실내 공간이 있어서 비 와도 괜찮아요. 우산만 챙기세요!"
];

/**
 * Mock 업로드 데이터 생성
 * @param {number} count - 생성할 게시물 수
 * @returns {Array} 생성된 게시물 배열
 */
export const generateMockUploads = (count = 50) => {
  const posts = [];
  const categories = ['bloom', 'landmark', 'food'];
  
  for (let i = 0; i < count; i++) {
    const category = randomItem(categories);
    const categoryData = categoryInfo[category];
    const region = randomItem(regions);
    const time = randomItem(timeLabels);
    const image = randomItem(sampleImages[category]);
    
    // 상세 위치 정보 추가
    const detailedLocationList = detailedLocations[category][region] || [region];
    const detailedLocation = randomItem(detailedLocationList);
    
    // 랜덤 태그 선택 (2-4개)
    const tagCount = 2 + Math.floor(Math.random() * 3);
    const tags = [];
    const shuffledTags = [...categoryData.tags].sort(() => 0.5 - Math.random());
    for (let j = 0; j < tagCount; j++) {
      if (shuffledTags[j]) tags.push(shuffledTags[j]);
    }
    
    const post = {
      id: `mock-${Date.now()}-${i}`,
      userId: `mock_user_${Math.floor(Math.random() * 50)}`, // Mock 사용자 ID!
      images: [image],
      location: region,
      detailedLocation: detailedLocation, // 상세 위치 추가!
      placeName: detailedLocation, // 장소명
      address: `${region} ${detailedLocation} ${Math.floor(Math.random() * 100) + 1}번길 ${Math.floor(Math.random() * 50) + 1}`, // 더 상세한 주소!
      tags: tags,
      note: `${detailedLocation}에서의 아름다운 순간! ${categoryData.name}을 공유합니다.`,
      timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(), // 실제 timestamp ⭐
      createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(), // 호환성
      timeLabel: time, // 임시 호환성 (동적 계산으로 대체됨)
      user: `여행자${Math.floor(Math.random() * 100)}`,
      likes: Math.floor(Math.random() * 50),
      isNew: i < 5, // 최근 5개만 NEW 표시
      isLocal: true,
      // AI 분류 정보
      category: category,
      categoryName: categoryData.name,
      aiLabels: categoryData.labels
    };
    
    posts.push(post);
  }
  
  // 시간순 정렬 (최신순)
  return posts.sort((a, b) => new Date(b.time) - new Date(a.time));
};

/**
 * 특정 지역의 Mock 데이터만 생성
 * @param {string} region - 지역명
 * @param {number} count - 생성할 게시물 수
 * @returns {Array} 생성된 게시물 배열
 */
export const generateMockUploadsForRegion = (region, count = 20) => {
  const posts = [];
  const categories = ['bloom', 'landmark', 'food'];
  
  // 각 카테고리별로 균등하게 생성
  const perCategory = Math.floor(count / 3);
  
  categories.forEach((category, catIndex) => {
    const categoryData = categoryInfo[category];
    const categoryCount = catIndex < 2 ? perCategory : count - (perCategory * 2);
    
    for (let i = 0; i < categoryCount; i++) {
      const time = randomItem(timeLabels);
      const image = randomItem(sampleImages[category]);
      
      const tagCount = 2 + Math.floor(Math.random() * 3);
      const tags = [];
      const shuffledTags = [...categoryData.tags].sort(() => 0.5 - Math.random());
      for (let j = 0; j < tagCount; j++) {
        if (shuffledTags[j]) tags.push(shuffledTags[j]);
      }
      
      const post = {
        id: `mock-${region}-${category}-${Date.now()}-${i}`,
        userId: `mock_user_${Math.floor(Math.random() * 50)}`, // Mock 사용자 ID!
        images: [image],
        location: region,
        tags: tags,
        note: `${region}의 아름다운 ${categoryData.name}을 담았습니다!`,
        timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(), // 실제 timestamp ⭐
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        timeLabel: time, // 임시 호환성
        user: `여행자${Math.floor(Math.random() * 100)}`,
        likes: Math.floor(Math.random() * 50),
        isNew: Math.random() > 0.8,
        isLocal: true,
        category: category,
        categoryName: categoryData.name,
        aiLabels: categoryData.labels
      };
      
      posts.push(post);
    }
  });
  
  return posts.sort((a, b) => new Date(b.time) - new Date(a.time));
};

/**
 * Mock 데이터를 localStorage에 저장 (각 지역마다 최소 30개 보장)
 * @param {number} totalCount - 전체 생성할 게시물 수
 */
export const seedMockData = (totalCount = 100) => {
  // 서버 운영 전환: localStorage 저장 기능 제거
  void totalCount;
  console.log('🌱 Mock 데이터 seed 기능은 비활성화되었습니다.');
  return { total: 0, bloom: 0, landmark: 0, food: 0, regions: 0 };
  
  // 아래 로직은 더 이상 사용하지 않음
  
  const mockPosts = [];
  const minPerRegion = 5; // 각 지역 최소 사진 개수 (30개에서 5개로 감소)
  const categories = ['bloom', 'landmark', 'food'];
  
  // 1단계: 각 지역마다 최소 5개씩 균등하게 생성
  regions.forEach((region) => {
    for (let i = 0; i < minPerRegion; i++) {
      const category = categories[i % 3]; // 카테고리 균등 분배
      const categoryData = categoryInfo[category];
      const time = randomItem(timeLabels);
      const image = randomItem(sampleImages[category]);
      
      const detailedLocationList = detailedLocations[category][region] || [region];
      const detailedLocation = randomItem(detailedLocationList);
      
      const tagCount = 2 + Math.floor(Math.random() * 3);
      const tags = [];
      const shuffledTags = [...categoryData.tags].sort(() => 0.5 - Math.random());
      for (let j = 0; j < tagCount; j++) {
        if (shuffledTags[j]) tags.push(shuffledTags[j]);
      }
      
      // 각 지역별로 랜덤 오프셋을 추가하여 다양한 위치 생성
      const getRandomCoordinates = (region) => {
        // 대한민국 전 지역 좌표 (62개 전체)
        const baseCoords = {
          // 특별시/광역시
          '서울': { lat: 37.5665, lng: 126.9780 },
          '부산': { lat: 35.1796, lng: 129.0756 },
          '대구': { lat: 35.8714, lng: 128.6014 },
          '인천': { lat: 37.4563, lng: 126.7052 },
          '광주': { lat: 35.1595, lng: 126.8526 },
          '대전': { lat: 36.3504, lng: 127.3845 },
          '울산': { lat: 35.5384, lng: 129.3114 },
          '세종': { lat: 36.4800, lng: 127.2890 },
          
          // 경기도
          '수원': { lat: 37.2636, lng: 127.0286 },
          '용인': { lat: 37.2410, lng: 127.1775 },
          '성남': { lat: 37.4449, lng: 127.1388 },
          '고양': { lat: 37.6584, lng: 126.8320 },
          '부천': { lat: 37.5034, lng: 126.7660 },
          '안양': { lat: 37.3943, lng: 126.9568 },
          '파주': { lat: 37.7599, lng: 126.7800 },
          '평택': { lat: 36.9921, lng: 127.1128 },
          '화성': { lat: 37.1990, lng: 126.8310 },
          '김포': { lat: 37.6152, lng: 126.7158 },
          '광명': { lat: 37.4784, lng: 126.8664 },
          '이천': { lat: 37.2722, lng: 127.4350 },
          '양평': { lat: 37.4919, lng: 127.4875 },
          '가평': { lat: 37.8314, lng: 127.5095 },
          '포천': { lat: 37.8949, lng: 127.2004 },
          
          // 강원도
          '춘천': { lat: 37.8813, lng: 127.7298 },
          '강릉': { lat: 37.7519, lng: 128.8761 },
          '속초': { lat: 38.2070, lng: 128.5918 },
          '원주': { lat: 37.3422, lng: 127.9202 },
          '동해': { lat: 37.5247, lng: 129.1143 },
          '태백': { lat: 37.1640, lng: 128.9856 },
          '삼척': { lat: 37.4500, lng: 129.1656 },
          '평창': { lat: 37.3708, lng: 128.3897 },
          '양양': { lat: 38.0752, lng: 128.6190 },
          
          // 충청도
          '청주': { lat: 36.6424, lng: 127.4890 },
          '충주': { lat: 36.9910, lng: 127.9260 },
          '제천': { lat: 37.1326, lng: 128.1911 },
          '천안': { lat: 36.8151, lng: 127.1139 },
          '아산': { lat: 36.7898, lng: 127.0019 },
          '공주': { lat: 36.4465, lng: 127.1189 },
          '논산': { lat: 36.1869, lng: 127.0988 },
          '보령': { lat: 36.3334, lng: 126.6127 },
          
          // 경상도
          '포항': { lat: 36.0190, lng: 129.3435 },
          '경주': { lat: 35.8562, lng: 129.2247 },
          '구미': { lat: 36.1196, lng: 128.3441 },
          '안동': { lat: 36.5684, lng: 128.7294 },
          '울진': { lat: 36.9930, lng: 129.4006 },
          '창원': { lat: 35.2279, lng: 128.6815 },
          '진주': { lat: 35.1800, lng: 128.1076 },
          '통영': { lat: 34.8544, lng: 128.4332 },
          '사천': { lat: 35.0036, lng: 128.0642 },
          '거제': { lat: 34.8806, lng: 128.6211 },
          '김해': { lat: 35.2285, lng: 128.8894 },
          '양산': { lat: 35.3350, lng: 129.0374 },
          
          // 전라도
          '전주': { lat: 35.8242, lng: 127.1480 },
          '익산': { lat: 35.9483, lng: 126.9574 },
          '군산': { lat: 35.9677, lng: 126.7369 },
          '목포': { lat: 34.8118, lng: 126.3922 },
          '여수': { lat: 34.7604, lng: 127.6622 },
          '순천': { lat: 34.9506, lng: 127.4872 },
          '광양': { lat: 34.9407, lng: 127.6956 },
          '나주': { lat: 35.0160, lng: 126.7107 },
          '무안': { lat: 34.9900, lng: 126.4819 },
          '담양': { lat: 35.3210, lng: 126.9881 },
          
          // 제주도
          '제주': { lat: 33.4996, lng: 126.5312 }
        };
        
        const coords = baseCoords[region] || { lat: 37.5, lng: 127.0 };
        
        // 각 지역 내에서 랜덤 오프셋 추가 (약 5~10km 범위)
        const latOffset = (Math.random() - 0.5) * 0.1; // 위도 약 ±5.5km
        const lngOffset = (Math.random() - 0.5) * 0.1; // 경도 약 ±8km
        
        return {
          lat: coords.lat + latOffset,
          lng: coords.lng + lngOffset
        };
      };

      // 다양한 개인 노트 선택
      const personalNote = randomItem(personalNotes[category]);
      
      // 랜덤으로 질문/답변 추가 (30% 확률)
      const qnaList = [];
      if (Math.random() > 0.7) {
        const numQuestions = 1 + Math.floor(Math.random() * 3); // 1~3개 질문
        for (let q = 0; q < numQuestions; q++) {
          const question = {
            id: `q-${i}-${q}`,
            type: 'question',
            user: `여행자${Math.floor(Math.random() * 100)}`,
            content: randomItem(sampleQuestions),
            time: randomItem(['방금', '5분 전', '30분 전', '1시간 전']),
            avatar: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}`
          };
          qnaList.push(question);
          
          // 80% 확률로 답변 추가
          if (Math.random() > 0.2) {
            const answer = {
              id: `a-${i}-${q}`,
              type: 'answer',
              user: `여행자${Math.floor(Math.random() * 100)}`,
              content: randomItem(sampleAnswers),
              time: randomItem(['방금', '5분 전', '10분 전']),
              avatar: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}`,
              isAuthor: Math.random() > 0.5
            };
            qnaList.push(answer);
          }
        }
      }

      const post = {
        id: `mock-${region}-${Date.now()}-${i}`,
        userId: `mock_user_${Math.floor(Math.random() * 100)}`, // 랜덤 유저 ID
        images: [image],
        location: region,
        detailedLocation: detailedLocation,
        placeName: detailedLocation,
        address: `${region} ${detailedLocation}`,
        coordinates: getRandomCoordinates(region),
        tags: tags,
        note: personalNote,
        content: personalNote,
        qnaList: qnaList,
        timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(), // 실제 timestamp ⭐
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        timeLabel: time, // 임시 호환성
        user: `여행자${Math.floor(Math.random() * 100)}`,
        likes: Math.floor(Math.random() * 50),
        likesCount: Math.floor(Math.random() * 50),
        isNew: Math.random() > 0.95,
        isLocal: true,
        category: category,
        categoryName: categoryData.name,
        aiLabels: categoryData.labels
      };
      
      mockPosts.push(post);
    }
  });
  
  // 2단계: 나머지는 랜덤하게 분배 (최대 200개로 제한)
  const baseCount = regions.length * minPerRegion; // 기본 생성 개수
  const maxTotal = 200; // 최대 생성 개수 제한
  const remainingCount = Math.max(0, Math.min(maxTotal - baseCount, totalCount - baseCount));
  
  for (let i = 0; i < remainingCount; i++) {
    const category = randomItem(categories);
    const categoryData = categoryInfo[category];
    const region = randomItem(regions);
    const time = randomItem(timeLabels);
    const image = randomItem(sampleImages[category]);
    
    const detailedLocationList = detailedLocations[category][region] || [region];
    const detailedLocation = randomItem(detailedLocationList);
    
    const tagCount = 2 + Math.floor(Math.random() * 3);
    const tags = [];
    const shuffledTags = [...categoryData.tags].sort(() => 0.5 - Math.random());
    for (let j = 0; j < tagCount; j++) {
      if (shuffledTags[j]) tags.push(shuffledTags[j]);
    }
    
    // 랜덤 좌표 생성 함수 (2단계용 - 대한민국 전 지역)
    const getRandomCoordinates = (region) => {
      const baseCoords = {
        // 특별시/광역시
        '서울': { lat: 37.5665, lng: 126.9780 }, '부산': { lat: 35.1796, lng: 129.0756 },
        '대구': { lat: 35.8714, lng: 128.6014 }, '인천': { lat: 37.4563, lng: 126.7052 },
        '광주': { lat: 35.1595, lng: 126.8526 }, '대전': { lat: 36.3504, lng: 127.3845 },
        '울산': { lat: 35.5384, lng: 129.3114 }, '세종': { lat: 36.4800, lng: 127.2890 },
        // 경기도
        '수원': { lat: 37.2636, lng: 127.0286 }, '용인': { lat: 37.2410, lng: 127.1775 },
        '성남': { lat: 37.4449, lng: 127.1388 }, '고양': { lat: 37.6584, lng: 126.8320 },
        '부천': { lat: 37.5034, lng: 126.7660 }, '안양': { lat: 37.3943, lng: 126.9568 },
        '파주': { lat: 37.7599, lng: 126.7800 }, '평택': { lat: 36.9921, lng: 127.1128 },
        '화성': { lat: 37.1990, lng: 126.8310 }, '김포': { lat: 37.6152, lng: 126.7158 },
        '광명': { lat: 37.4784, lng: 126.8664 }, '이천': { lat: 37.2722, lng: 127.4350 },
        '양평': { lat: 37.4919, lng: 127.4875 }, '가평': { lat: 37.8314, lng: 127.5095 },
        '포천': { lat: 37.8949, lng: 127.2004 },
        // 강원도
        '춘천': { lat: 37.8813, lng: 127.7298 }, '강릉': { lat: 37.7519, lng: 128.8761 },
        '속초': { lat: 38.2070, lng: 128.5918 }, '원주': { lat: 37.3422, lng: 127.9202 },
        '동해': { lat: 37.5247, lng: 129.1143 }, '태백': { lat: 37.1640, lng: 128.9856 },
        '삼척': { lat: 37.4500, lng: 129.1656 }, '평창': { lat: 37.3708, lng: 128.3897 },
        '양양': { lat: 38.0752, lng: 128.6190 },
        // 충청도
        '청주': { lat: 36.6424, lng: 127.4890 }, '충주': { lat: 36.9910, lng: 127.9260 },
        '제천': { lat: 37.1326, lng: 128.1911 }, '천안': { lat: 36.8151, lng: 127.1139 },
        '아산': { lat: 36.7898, lng: 127.0019 }, '공주': { lat: 36.4465, lng: 127.1189 },
        '논산': { lat: 36.1869, lng: 127.0988 }, '보령': { lat: 36.3334, lng: 126.6127 },
        // 경상도
        '포항': { lat: 36.0190, lng: 129.3435 }, '경주': { lat: 35.8562, lng: 129.2247 },
        '구미': { lat: 36.1196, lng: 128.3441 }, '안동': { lat: 36.5684, lng: 128.7294 },
        '울진': { lat: 36.9930, lng: 129.4006 }, '창원': { lat: 35.2279, lng: 128.6815 },
        '진주': { lat: 35.1800, lng: 128.1076 }, '통영': { lat: 34.8544, lng: 128.4332 },
        '사천': { lat: 35.0036, lng: 128.0642 }, '거제': { lat: 34.8806, lng: 128.6211 },
        '김해': { lat: 35.2285, lng: 128.8894 }, '양산': { lat: 35.3350, lng: 129.0374 },
        // 전라도
        '전주': { lat: 35.8242, lng: 127.1480 }, '익산': { lat: 35.9483, lng: 126.9574 },
        '군산': { lat: 35.9677, lng: 126.7369 }, '목포': { lat: 34.8118, lng: 126.3922 },
        '여수': { lat: 34.7604, lng: 127.6622 }, '순천': { lat: 34.9506, lng: 127.4872 },
        '광양': { lat: 34.9407, lng: 127.6956 }, '나주': { lat: 35.0160, lng: 126.7107 },
        '무안': { lat: 34.9900, lng: 126.4819 }, '담양': { lat: 35.3210, lng: 126.9881 },
        // 제주도
        '제주': { lat: 33.4996, lng: 126.5312 }
      };
      
      const coords = baseCoords[region] || { lat: 37.5, lng: 127.0 };
      const latOffset = (Math.random() - 0.5) * 0.1;
      const lngOffset = (Math.random() - 0.5) * 0.1;
      
      return {
        lat: coords.lat + latOffset,
        lng: coords.lng + lngOffset
      };
    };

    // 다양한 개인 노트 선택
    const personalNote = randomItem(personalNotes[category]);
    
    // 랜덤으로 질문/답변 추가 (30% 확률)
    const qnaList = [];
    if (Math.random() > 0.7) {
      const numQuestions = 1 + Math.floor(Math.random() * 3);
      for (let q = 0; q < numQuestions; q++) {
        qnaList.push({
          id: `q-${i}-${q}`,
          type: 'question',
          user: `여행자${Math.floor(Math.random() * 100)}`,
          content: randomItem(sampleQuestions),
          time: randomItem(['방금', '5분 전', '30분 전', '1시간 전']),
          avatar: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}`
        });
        
        if (Math.random() > 0.2) {
          qnaList.push({
            id: `a-${i}-${q}`,
            type: 'answer',
            user: `여행자${Math.floor(Math.random() * 100)}`,
            content: randomItem(sampleAnswers),
            time: randomItem(['방금', '5분 전', '10분 전']),
            avatar: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}`,
            isAuthor: Math.random() > 0.5
          });
        }
      }
    }

    const post = {
      id: `mock-extra-${Date.now()}-${i}`,
      userId: `mock_user_${Math.floor(Math.random() * 100)}`, // 랜덤 유저 ID
      images: [image],
      location: region,
      detailedLocation: detailedLocation,
      placeName: detailedLocation,
      address: `${region} ${detailedLocation}`,
      coordinates: getRandomCoordinates(region),
      tags: tags,
      note: personalNote,
      content: personalNote,
      qnaList: qnaList,
      time: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      timeLabel: time,
      user: `여행자${Math.floor(Math.random() * 100)}`,
      likes: Math.floor(Math.random() * 50),
      likesCount: Math.floor(Math.random() * 50),
      isNew: i < 5,
      isLocal: true,
      category: category,
      categoryName: categoryData.name,
      aiLabels: categoryData.labels
    };
    
    mockPosts.push(post);
  }
  
  // 서버 운영 전환: localStorage 저장 제거 → 생성만 하고 반환
  const allPosts = [...mockPosts];
  
  // 통계 출력
  const stats = {
    total: allPosts.length,
    bloom: allPosts.filter(p => p.category === 'bloom').length,
    landmark: allPosts.filter(p => p.category === 'landmark').length,
    food: allPosts.filter(p => p.category === 'food').length,
    regions: [...new Set(allPosts.map(p => p.location))].length
  };
  
  console.log('✅ Mock 데이터 생성 완료!');
  console.log('📊 통계:');
  console.log(`  - 전체: ${stats.total}개`);
  console.log(`  - 🌸 개화 상황: ${stats.bloom}개`);
  console.log(`  - 🏞️ 가볼만한곳: ${stats.landmark}개`);
  console.log(`  - 🍜 맛집 정보: ${stats.food}개`);
  console.log(`  - 📍 지역 수: ${stats.regions}개 (각 지역 최소 ${minPerRegion}개)`);
  
  return stats;
};

/**
 * Mock 데이터 초기화 (모두 삭제)
 */
export const clearMockData = () => {
  // 서버 운영 전환: localStorage 제거 → no-op
  console.log('🗑️ Mock 데이터 삭제 기능은 비활성화되었습니다.');
};

/**
 * 카테고리별 통계 확인
 */
export const getMockDataStats = () => {
  const posts = [];
  
  const stats = {
    total: posts.length,
    bloom: posts.filter(p => p.category === 'bloom').length,
    landmark: posts.filter(p => p.category === 'landmark' || p.category === 'scenic').length,
    food: posts.filter(p => p.category === 'food').length,
    general: posts.filter(p => !p.category || p.category === 'general').length,
    byRegion: {}
  };
  
  // 지역별 통계
  regions.forEach(region => {
    const regionPosts = posts.filter(p => p.location?.includes(region));
    if (regionPosts.length > 0) {
      stats.byRegion[region] = {
        total: regionPosts.length,
        bloom: regionPosts.filter(p => p.category === 'bloom').length,
        landmark: regionPosts.filter(p => p.category === 'landmark' || p.category === 'scenic').length,
        food: regionPosts.filter(p => p.category === 'food').length
      };
    }
  });
  
  return stats;
};

/**
 * 단일 Mock 게시물 생성
 * @returns {Object} 생성된 게시물 객체
 */
export const generateMockPost = () => {
  const categories = ['bloom', 'landmark', 'food'];
  const category = randomItem(categories);
  const categoryData = categoryInfo[category];
  const region = randomItem(regions);
  const time = randomItem(timeLabels);
  const image = randomItem(sampleImages[category]);
  
  // 상세 위치 정보 추가
  const detailedLocationList = detailedLocations[category][region] || [region];
  const detailedLocation = randomItem(detailedLocationList);
  
  // 랜덤 태그 선택 (2-4개)
  const tagCount = 2 + Math.floor(Math.random() * 3);
  const tags = [];
  const shuffledTags = [...categoryData.tags].sort(() => 0.5 - Math.random());
  for (let j = 0; j < tagCount; j++) {
    if (shuffledTags[j]) tags.push(shuffledTags[j]);
  }
  
  return {
    id: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    userId: `mock_user_${Math.floor(Math.random() * 50)}`, // Mock 사용자 ID (테스터와 다름!)
    images: [image],
    location: region,
    detailedLocation: detailedLocation,
    placeName: detailedLocation,
    address: `${region} ${detailedLocation} ${Math.floor(Math.random() * 100) + 1}번길 ${Math.floor(Math.random() * 50) + 1}`, // 더 상세한 주소!
    tags: tags,
    note: `${detailedLocation}에서의 아름다운 순간! ${categoryData.name}을 공유합니다.`,
    time: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    timeLabel: time,
    user: `여행자${Math.floor(Math.random() * 100)}`,
    likes: Math.floor(Math.random() * 50),
    isNew: true,
    isLocal: true,
    // AI 분류 정보
    category: category,
    categoryName: categoryData.name,
    aiLabels: categoryData.labels
  };
};

export default {
  generateMockUploads,
  generateMockUploadsForRegion,
  generateMockPost,
  seedMockData,
  clearMockData,
  getMockDataStats
};






































