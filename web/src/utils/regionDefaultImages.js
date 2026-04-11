// 각 지역의 대표 기본 이미지 - 그 지역의 특징/랜드마크가 담긴 사진 (지역상세 등)
export const regionDefaultImages = {
  // 도(道) 단위
  '전북': 'https://images.unsplash.com/photo-1548013146-72479768bada?w=800&auto=format&fit=crop', // 전주 한옥/전통
  '전남': 'https://images.unsplash.com/photo-1578022761797-b8636ac1773c?w=800&auto=format&fit=crop', // 등대·해안
  '경북': 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&auto=format&fit=crop', // 경주 석탑·불국사
  '경남': 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&auto=format&fit=crop', // 해안·절경
  '전국': 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=800&auto=format&fit=crop', // 지도·전국

  // 수도권
  '서울': 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&auto=format&fit=crop', // N서울타워·남산
  '인천': 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&auto=format&fit=crop', // 인천공항·국제관문
  '수원': 'https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=800&auto=format&fit=crop', // 수원화성
  '성남': 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800&auto=format&fit=crop', // 판교
  '고양': 'https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=800&auto=format&fit=crop', // 일산 호수공원
  '용인': 'https://images.unsplash.com/photo-1573074617613-fc2284c77009?w=800&auto=format&fit=crop', // 에버랜드
  '부천': 'https://images.unsplash.com/photo-1524850011238-e3d235c7d4c9?w=800&auto=format&fit=crop', // 도시
  '안산': 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&auto=format&fit=crop', // 도시
  '안양': 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&auto=format&fit=crop', // 안양천
  '남양주': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop', // 자연
  '화성': 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&auto=format&fit=crop', // 제부도
  '파주': 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop', // 헤이리
  '의정부': 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&auto=format&fit=crop', // 도시
  '평택': 'https://images.unsplash.com/photo-1578022761797-b8636ac1773c?w=800&auto=format&fit=crop', // 항구
  '시흥': 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&auto=format&fit=crop', // 도시
  '김포': 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&auto=format&fit=crop', // 한강
  '광명': 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop', // 동굴
  '광주': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format&fit=crop', // 무등산·자연
  '군포': 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&auto=format&fit=crop', // 도시
  '하남': 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&auto=format&fit=crop', // 도시
  '오산': 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&auto=format&fit=crop', // 도시
  '이천': 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&auto=format&fit=crop', // 도자기
  '안성': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop', // 자연
  '의왕': 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&auto=format&fit=crop', // 도시
  '양평': 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&auto=format&fit=crop', // 두물머리
  '여주': 'https://images.unsplash.com/photo-1548013146-72479768bada?w=800&auto=format&fit=crop', // 신륵사
  '동두천': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop', // 소요산
  '과천': 'https://images.unsplash.com/photo-1535083783855-76ae62b2914e?w=800&auto=format&fit=crop', // 서울대공원
  '가평': 'https://images.unsplash.com/photo-1590736969955-71cc94901144?w=800&auto=format&fit=crop', // 남이섬
  '양주': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop', // 자연
  '포천': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop', // 아트밸리
  '연천': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop', // DMZ
  
  // 강원권
  '춘천': 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&auto=format&fit=crop', // 소양강
  '원주': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop', // 치악산
  '강릉': 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&auto=format&fit=crop', // 경포대
  '속초': 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&auto=format&fit=crop', // 속초/동해
  '동해': 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&auto=format&fit=crop', // 추암촛대바위
  '태백': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop', // 태백산
  '삼척': 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop', // 환선굴
  '홍천': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop', // 자연
  '횡성': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop', // 자연
  '영월': 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&auto=format&fit=crop', // 동강
  '평창': 'https://images.unsplash.com/photo-1551524164-687a55dd1126?w=800&auto=format&fit=crop', // 스키
  '정선': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop', // 레일바이크
  '철원': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop', // DMZ
  '화천': 'https://images.unsplash.com/photo-1548177338-1da4f6b84aac?w=800&auto=format&fit=crop', // 산천어
  '양구': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format&fit=crop', // 펀치볼
  '인제': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format&fit=crop', // 내린천
  '고성': 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&auto=format&fit=crop', // 화진포
  '양양': 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&auto=format&fit=crop', // 낙산사/서핑
  
  // 충청권
  '대전': 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&auto=format&fit=crop', // 엑스포
  '세종': 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800&auto=format&fit=crop', // 호수공원
  '청주': 'https://images.unsplash.com/photo-1524850011238-e3d235c7d4c9?w=800&auto=format&fit=crop', // 상당산성
  '충주': 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&auto=format&fit=crop', // 충주호
  '제천': 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&auto=format&fit=crop', // 청풍호
  '천안': 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&auto=format&fit=crop', // 독립기념관
  '공주': 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&auto=format&fit=crop', // 공산성
  '보령': 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&auto=format&fit=crop', // 대천해수욕장
  '아산': 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&auto=format&fit=crop', // 현충사
  '서산': 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&auto=format&fit=crop', // 해미읍성
  '논산': 'https://images.unsplash.com/photo-1548013146-72479768bada?w=800&auto=format&fit=crop', // 관촉사
  '계룡': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop', // 계룡산
  '당진': 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&auto=format&fit=crop', // 왜목마을
  '금산': 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=800&auto=format&fit=crop', // 인삼
  '부여': 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&auto=format&fit=crop', // 백제
  '서천': 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&auto=format&fit=crop', // 생태원/바다
  '청양': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop', // 칠갑산
  '홍성': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop', // 자연
  '예산': 'https://images.unsplash.com/photo-1548013146-72479768bada?w=800&auto=format&fit=crop', // 수덕사
  '태안': 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&auto=format&fit=crop', // 안면도
  
  // 전라권
  '전주': 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&auto=format&fit=crop', // 한옥마을
  '군산': 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&auto=format&fit=crop', // 근대문화
  '익산': 'https://images.unsplash.com/photo-1548013146-72479768bada?w=800&auto=format&fit=crop', // 미륵사지
  '정읍': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop', // 내장산
  '남원': 'https://images.unsplash.com/photo-1548013146-72479768bada?w=800&auto=format&fit=crop', // 광한루
  '김제': 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&auto=format&fit=crop', // 지평선
  '완주': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop', // 자연
  '진안': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop', // 마이산
  '무주': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop', // 덕유산
  '장수': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop', // 자연
  '임실': 'https://images.unsplash.com/photo-1452195100486-9cc805987862?w=800&auto=format&fit=crop', // 치즈
  '순창': 'https://images.unsplash.com/photo-1583919860101-c7fc4f6f4f0f?w=800&auto=format&fit=crop', // 고추장
  '고창': 'https://images.unsplash.com/photo-1548013146-72479768bada?w=800&auto=format&fit=crop', // 고인돌
  '부안': 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&auto=format&fit=crop', // 변산반도
  '광주': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop', // 무등산
  '목포': 'https://images.unsplash.com/photo-1578022761797-b8636ac1773c?w=800&auto=format&fit=crop', // 유달산/항구
  '여수': 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&auto=format&fit=crop', // 여수 밤바다
  '순천': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format&fit=crop', // 순천만
  '나주': 'https://images.unsplash.com/photo-1587049352846-4a222e784578?w=800&auto=format&fit=crop', // 나주배
  '광양': 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=800&auto=format&fit=crop', // 매화
  '담양': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop', // 죽녹원
  '곡성': 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=800&auto=format&fit=crop', // 기차마을
  '구례': 'https://images.unsplash.com/photo-1548013146-72479768bada?w=800&auto=format&fit=crop', // 화엄사
  '고흥': 'https://images.unsplash.com/photo-1516849677043-ef67c9557e16?w=800&auto=format&fit=crop', // 우주센터
  '보성': 'https://images.unsplash.com/photo-1563181236-62a93a9e2cf8?w=800&auto=format&fit=crop', // 녹차밭
  '화순': 'https://images.unsplash.com/photo-1548013146-72479768bada?w=800&auto=format&fit=crop', // 고인돌
  '장흥': 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&auto=format&fit=crop', // 정남진
  '강진': 'https://images.unsplash.com/photo-1610735241340-fd3229ad1d97?w=800&auto=format&fit=crop', // 청자
  '해남': 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&auto=format&fit=crop', // 땅끝마을
  '영암': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop', // 월출산
  '무안': 'https://images.unsplash.com/photo-1578022761797-b8636ac1773c?w=800&auto=format&fit=crop', // 공항
  '함평': 'https://images.unsplash.com/photo-1535083783855-76ae62b2914e?w=800&auto=format&fit=crop', // 나비
  '영광': 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&auto=format&fit=crop', // 백수해안도로
  '장성': 'https://images.unsplash.com/photo-1548013146-72479768bada?w=800&auto=format&fit=crop', // 백양사
  '완도': 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&auto=format&fit=crop', // 청산도
  '진도': 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&auto=format&fit=crop', // 신비의바닷길
  '신안': 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&auto=format&fit=crop', // 증도
  
  // 경상권
  '대구': 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800&auto=format&fit=crop', // 대구 오페라하우스·현대건축
  '부산': 'https://images.unsplash.com/photo-1580522154071-c1ca47a859ad?w=800&auto=format&fit=crop', // 광안대교·해운대
  '울산': 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&auto=format&fit=crop', // 대왕암공원
  '포항': 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&auto=format&fit=crop', // 호미곶
  '경주': 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&auto=format&fit=crop', // 불국사
  '김천': 'https://images.unsplash.com/photo-1548013146-72479768bada?w=800&auto=format&fit=crop', // 직지사
  '안동': 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&auto=format&fit=crop', // 하회마을
  '구미': 'https://images.unsplash.com/photo-1524850011238-e3d235c7d4c9?w=800&auto=format&fit=crop', // IT도시
  '영주': 'https://images.unsplash.com/photo-1548013146-72479768bada?w=800&auto=format&fit=crop', // 부석사
  '영천': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format&fit=crop', // 자연
  '상주': 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800&auto=format&fit=crop', // 자전거
  '문경': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format&fit=crop', // 문경새재
  '경산': 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&auto=format&fit=crop', // 도시
  '창원': 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=800&auto=format&fit=crop', // 진해벚꽃
  '진주': 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&auto=format&fit=crop', // 진주성
  '통영': 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&auto=format&fit=crop', // 케이블카
  '사천': 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&auto=format&fit=crop', // 항공
  '김해': 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&auto=format&fit=crop', // 가야
  '밀양': 'https://images.unsplash.com/photo-1548013146-72479768bada?w=800&auto=format&fit=crop', // 영남루
  '거제': 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&auto=format&fit=crop', // 외도
  '양산': 'https://images.unsplash.com/photo-1548013146-72479768bada?w=800&auto=format&fit=crop', // 통도사
  '의령': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format&fit=crop', // 자연
  '함안': 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&auto=format&fit=crop', // 가야
  '창녕': 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&auto=format&fit=crop', // 우포늪
  '고성': 'https://images.unsplash.com/photo-1535083783855-76ae62b2914e?w=800&auto=format&fit=crop', // 공룡
  '남해': 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&auto=format&fit=crop', // 독일마을
  '하동': 'https://images.unsplash.com/photo-1563181236-62a93a9e2cf8?w=800&auto=format&fit=crop', // 녹차
  '산청': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format&fit=crop', // 지리산
  '함양': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format&fit=crop', // 상림
  '거창': 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&auto=format&fit=crop', // 수승대
  '합천': 'https://images.unsplash.com/photo-1548013146-72479768bada?w=800&auto=format&fit=crop', // 해인사
  
  // 제주권
  '제주': 'https://images.unsplash.com/photo-1590559899731-a382839e5549?w=800&auto=format&fit=crop', // 제주 돌하르방·해안·특색
  '서귀포': 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&auto=format&fit=crop', // 폭포·해안
  
  // 기본 이미지
  'default': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format&fit=crop'
};

// 지역 이름에서 대표 이미지 가져오기
export const getRegionDefaultImage = (regionName) => {
  if (!regionName) return regionDefaultImages.default;
  
  // 정확한 지역명으로 먼저 찾기
  if (regionDefaultImages[regionName]) {
    return regionDefaultImages[regionName];
  }
  
  // 부분 일치로 찾기
  const matchedKey = Object.keys(regionDefaultImages).find(key => 
    regionName.includes(key) || key.includes(regionName)
  );
  
  return matchedKey ? regionDefaultImages[matchedKey] : regionDefaultImages.default;
};

// 실제 업로드된 사진이 있으면 그걸 우선 사용, 없으면 기본 이미지
export const getRegionDisplayImage = (regionName, uploadedImage) => {
  if (uploadedImage && uploadedImage.trim() !== '') {
    return uploadedImage;
  }
  return getRegionDefaultImage(regionName);
};
