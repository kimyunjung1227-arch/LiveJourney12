# 프론트엔드 API 연동 가이드

## 🎯 설정 완료!

백엔드 API가 프론트엔드에 완전히 연동되었습니다!

## 📁 생성된 파일

```
web/src/api/
├── axios.js         ✅ API 클라이언트 (토큰 자동 추가)
├── posts.js         ✅ 게시물 API
├── points.js        ✅ 포인트 API
├── rewards.js       ✅ 보상 API
├── search.js        ✅ 검색 API
├── locations.js     ✅ 위치 API
├── upload.js        ✅ 파일 업로드 API
├── users.js         ✅ 사용자 API
└── index.js         ✅ 중앙 export

web/src/contexts/
└── AuthContext.jsx  ✅ 인증 컨텍스트 (로그인/회원가입)
```

## 🚀 사용 방법

### 1. 환경 변수 설정

`web/.env` 파일 생성:
```env
VITE_API_URL=http://localhost:5000/api
```

### 2. 인증 사용하기

```jsx
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const { user, login, signup, logout, isAuthenticated } = useAuth();

  const handleLogin = async () => {
    const result = await login('user@example.com', 'password123');
    if (result.success) {
      console.log('로그인 성공!');
    }
  };

  return (
    <div>
      {isAuthenticated ? (
        <p>환영합니다, {user.username}님!</p>
      ) : (
        <button onClick={handleLogin}>로그인</button>
      )}
    </div>
  );
}
```

### 3. 게시물 API 사용하기

```jsx
import { postsAPI } from '../api';

function PostList() {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      const data = await postsAPI.getPosts({ 
        page: 1, 
        limit: 20,
        isRealtime: true 
      });
      setPosts(data.posts);
    } catch (error) {
      console.error('게시물 로드 실패:', error);
    }
  };

  return (
    <div>
      {posts.map(post => (
        <div key={post._id}>{post.content}</div>
      ))}
    </div>
  );
}
```

### 4. 게시물 작성

```jsx
import { postsAPI, uploadAPI } from '../api';

function CreatePost() {
  const handleSubmit = async (formData) => {
    try {
      // 1. 이미지 업로드
      const uploadResult = await uploadAPI.uploadImages(formData.files);
      
      // 2. 게시물 작성
      const result = await postsAPI.createPost({
        images: uploadResult.urls,
        content: formData.content,
        location: {
          name: formData.locationName,
          lat: formData.lat,
          lon: formData.lon,
          region: formData.region,
          country: '한국'
        },
        tags: formData.tags,
        isRealtime: true
      });

      console.log('게시물 작성 성공!', result.pointsEarned, 'P 획득');
    } catch (error) {
      console.error('게시물 작성 실패:', error);
    }
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### 5. 좋아요 & 댓글

```jsx
import { postsAPI } from '../api';

function PostActions({ postId }) {
  const handleLike = async () => {
    try {
      const result = await postsAPI.likePost(postId);
      console.log('좋아요 성공!', result.likesCount);
    } catch (error) {
      console.error('좋아요 실패:', error);
    }
  };

  const handleComment = async (content) => {
    try {
      const result = await postsAPI.addComment(postId, content);
      console.log('댓글 작성 성공! 10P 획득');
    } catch (error) {
      console.error('댓글 작성 실패:', error);
    }
  };

  return (
    <div>
      <button onClick={handleLike}>좋아요</button>
      <button onClick={() => handleComment('멋진 사진이네요!')}>댓글 달기</button>
    </div>
  );
}
```

### 6. 포인트 조회

```jsx
import { pointsAPI } from '../api';

function PointsBalance() {
  const [points, setPoints] = useState(0);

  useEffect(() => {
    loadPoints();
  }, []);

  const loadPoints = async () => {
    try {
      const data = await pointsAPI.getPointBalance();
      setPoints(data.points);
    } catch (error) {
      console.error('포인트 조회 실패:', error);
    }
  };

  return <div>보유 포인트: {points}P</div>;
}
```

### 7. 보상 교환

```jsx
import { rewardsAPI } from '../api';

function RewardShop() {
  const [rewards, setRewards] = useState([]);

  const loadRewards = async () => {
    const data = await rewardsAPI.getRewards({ category: 'voucher' });
    setRewards(data.rewards);
  };

  const handleExchange = async (rewardId) => {
    try {
      const result = await rewardsAPI.exchangeReward(rewardId);
      alert(`교환 완료! 남은 포인트: ${result.remainingPoints}P`);
    } catch (error) {
      alert(error.response?.data?.error || '교환 실패');
    }
  };

  return (
    <div>
      {rewards.map(reward => (
        <div key={reward._id}>
          <h3>{reward.name}</h3>
          <p>{reward.pointsCost}P</p>
          <button onClick={() => handleExchange(reward._id)}>교환하기</button>
        </div>
      ))}
    </div>
  );
}
```

### 8. 검색

```jsx
import { searchAPI } from '../api';

function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);

  const handleSearch = async () => {
    try {
      const data = await searchAPI.search(query, { type: 'all' });
      setResults(data.results);
    } catch (error) {
      console.error('검색 실패:', error);
    }
  };

  return (
    <div>
      <input 
        value={query} 
        onChange={(e) => setQuery(e.target.value)}
        placeholder="검색..."
      />
      <button onClick={handleSearch}>검색</button>
      
      {results && (
        <div>
          <h3>게시물: {results.posts?.length}개</h3>
          <h3>사용자: {results.users?.length}명</h3>
          <h3>장소: {results.locations?.length}곳</h3>
        </div>
      )}
    </div>
  );
}
```

### 9. 위치 기반 검색

```jsx
import { locationsAPI } from '../api';

function NearbyPosts() {
  const [nearbyPosts, setNearbyPosts] = useState([]);

  const loadNearbyPosts = async () => {
    // 현재 위치 가져오기
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      
      try {
        const data = await locationsAPI.getNearbyPosts(
          latitude, 
          longitude, 
          5000 // 5km 반경
        );
        setNearbyPosts(data.posts);
      } catch (error) {
        console.error('주변 게시물 조회 실패:', error);
      }
    });
  };

  return (
    <div>
      <button onClick={loadNearbyPosts}>주변 정보 보기</button>
      {nearbyPosts.map(post => (
        <div key={post._id}>{post.location.name}</div>
      ))}
    </div>
  );
}
```

### 10. 프로필 수정

```jsx
import { usersAPI, uploadAPI } from '../api';

function EditProfile() {
  const handleUpdateProfile = async (formData) => {
    try {
      // 프로필 이미지 업로드 (선택)
      let profileImageUrl = null;
      if (formData.profileImage) {
        const uploadResult = await uploadAPI.uploadProfileImage(formData.profileImage);
        profileImageUrl = uploadResult.url;
      }

      // 프로필 업데이트
      const result = await usersAPI.updateProfile({
        username: formData.username,
        bio: formData.bio,
        profileImage: profileImageUrl
      });

      alert('프로필이 업데이트되었습니다!');
    } catch (error) {
      console.error('프로필 업데이트 실패:', error);
    }
  };

  return <form onSubmit={handleUpdateProfile}>...</form>;
}
```

## 🔐 인증 토큰 관리

토큰은 자동으로 관리됩니다:
- 로그인 시 자동으로 `localStorage`에 저장
- 모든 API 요청에 자동으로 포함
- 401 에러 시 자동으로 로그아웃

## 🔄 Mock 모드

백엔드가 실행되지 않아도 앱이 작동합니다:
- AuthContext에서 자동으로 Mock 모드로 전환
- 테스트 계정: `test@livejourney.com` / `password123`
- 로컬 스토리지 기반 Mock 데이터 사용

## ⚡ 빠른 테스트

### 백엔드 없이 테스트
```jsx
const { loginAsGuest } = useAuth();

// 테스트 계정으로 즉시 로그인
loginAsGuest();
```

### 백엔드와 함께 테스트
```bash
# 터미널 1: 백엔드 실행
cd backend
npm run dev

# 터미널 2: 프론트엔드 실행
cd web
npm run dev
```

## 📊 포인트 적립 확인

```jsx
const result = await postsAPI.createPost({...});
console.log('획득 포인트:', result.pointsEarned); // 50P

const comment = await postsAPI.addComment(postId, content);
console.log('획득 포인트: 10P');
```

## 🐛 에러 처리

```jsx
try {
  await postsAPI.createPost({...});
} catch (error) {
  if (error.response) {
    // 서버 응답 에러
    console.error('에러 메시지:', error.response.data.error);
  } else if (error.request) {
    // 요청은 보냈으나 응답 없음 (백엔드 미실행)
    console.error('백엔드가 실행되지 않았습니다.');
  } else {
    // 기타 에러
    console.error('에러:', error.message);
  }
}
```

## 🎉 완료!

이제 모든 화면에서 실제 백엔드 API를 사용할 수 있습니다!

**다음 단계:**
1. 백엔드 서버 실행: `cd backend && npm run dev`
2. 프론트엔드 실행: `cd web && npm run dev`
3. 회원가입 후 게시물 작성해보기
4. 포인트가 자동으로 적립되는지 확인




































