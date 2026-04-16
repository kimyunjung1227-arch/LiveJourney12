const express = require('express');
const router = express.Router();
const passport = require('../middleware/passport');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/secrets');

const jwtSecret = getJwtSecret();

// ============================================
// 소셜 로그인 시작 (OAuth 인증 페이지로 리다이렉트)
// ============================================

// 카카오 로그인
router.get('/kakao', (req, res, next) => {
  // 환경 변수가 없으면 Mock 모드로 처리
  if (!process.env.KAKAO_CLIENT_ID || !process.env.KAKAO_CLIENT_SECRET) {
    console.warn('⚠️ 카카오 로그인 환경 변수가 설정되지 않았습니다. Mock 모드로 실행됩니다.');
    // Mock 사용자 생성
    const mockUser = {
      id: `kakao_mock_${Date.now()}`,
      username: '카카오 사용자',
      email: `kakao_${Date.now()}@mock.com`,
      profileImage: null,
      socialProvider: 'kakao',
      createdAt: new Date()
    };
    
    const token = jwt.sign(
      { userId: mockUser.id, email: mockUser.email },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectUrl = `${frontendUrl}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify(mockUser))}`;
    return res.redirect(redirectUrl);
  }
  passport.authenticate('kakao')(req, res, next);
});

// 네이버 로그인 (OAuth 시작)
// - 네이버는 client info invalid가 자주 발생하므로, 시작 시 redirect_uri와 client_id가
//   전략에 설정된 값과 일치하도록 passport를 통해 위임합니다.
router.get('/naver', (req, res, next) => {
  if (!process.env.NAVER_CLIENT_ID || !process.env.NAVER_CLIENT_SECRET) {
    return res.status(500).json({
      success: false,
      error: '네이버 OAuth 환경 변수가 설정되지 않았습니다. (NAVER_CLIENT_ID, NAVER_CLIENT_SECRET)'
    });
  }

  // state는 CSRF 방지를 위해 매 요청마다 다르게 설정
  req.session = req.session || {};
  req.session.oauthState = `lj_${Date.now()}`;

  return passport.authenticate('naver', {
    session: false,
    state: req.session.oauthState, // naver는 state 권장
    scope: ['name', 'email']
  })(req, res, next);
});

// 구글 로그인
router.get('/google', (req, res, next) => {
  // 환경 변수가 없으면 Mock 모드로 처리
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn('⚠️ 구글 로그인 환경 변수가 설정되지 않았습니다. Mock 모드로 실행됩니다.');
    // Mock 사용자 생성
    const mockUser = {
      id: `google_mock_${Date.now()}`,
      username: '구글 사용자',
      email: `google_${Date.now()}@mock.com`,
      profileImage: null,
      socialProvider: 'google',
      createdAt: new Date()
    };
    
    const token = jwt.sign(
      { userId: mockUser.id, email: mockUser.email },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectUrl = `${frontendUrl}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify(mockUser))}`;
    return res.redirect(redirectUrl);
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

// ============================================
// 소셜 로그인 콜백 (OAuth 제공자가 리다이렉트)
// ============================================

// 카카오 콜백
router.get('/kakao/callback',
  passport.authenticate('kakao', { session: false, failureRedirect: '/api/auth/failure' }),
  (req, res) => {
    try {
      const user = req.user;
      
      // JWT 토큰 생성
      const token = jwt.sign(
        { userId: user._id, email: user.email },
        jwtSecret,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      // 사용자 정보를 쿼리 파라미터로 전달 (프론트엔드로 리다이렉트)
      const userData = {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        profileImage: user.profileImage,
        socialProvider: user.socialProvider,
        createdAt: user.createdAt
      };

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const redirectUrl = `${frontendUrl}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify(userData))}`;
      
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('카카오 로그인 콜백 오류:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent('로그인 처리 중 오류가 발생했습니다.')}`);
    }
  }
);

// 네이버 콜백
router.get('/naver/callback', (req, res, next) => {
  if (!process.env.NAVER_CLIENT_ID || !process.env.NAVER_CLIENT_SECRET) {
    return res.status(500).json({
      success: false,
      error: '네이버 OAuth 환경 변수가 설정되지 않았습니다. (NAVER_CLIENT_ID, NAVER_CLIENT_SECRET)'
    });
  }

  return passport.authenticate('naver', { session: false }, (err, user) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    if (err) {
      console.error('네이버 로그인 오류:', err);
      return res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent('네이버 로그인에 실패했습니다.')}`);
    }

    if (!user) {
      return res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent('사용자 정보를 가져올 수 없습니다.')}`);
    }

    try {
      const token = jwt.sign(
        { userId: user._id, email: user.email },
        jwtSecret,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      const userData = {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        profileImage: user.profileImage,
        socialProvider: user.socialProvider,
        createdAt: user.createdAt
      };

      const redirectUrl = `${frontendUrl}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify(userData))}`;
      return res.redirect(redirectUrl);
    } catch (e) {
      console.error('네이버 콜백 처리 오류:', e);
      return res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent('로그인 처리 중 오류가 발생했습니다.')}`);
    }
  })(req, res, next);
});

// (선택) 네이버 설정 디버그용 엔드포인트
router.get('/naver/debug', (req, res) => {
  res.json({
    success: true,
    NAVER_CLIENT_ID: !!process.env.NAVER_CLIENT_ID,
    NAVER_CLIENT_SECRET: !!process.env.NAVER_CLIENT_SECRET,
    NAVER_CALLBACK_URL: process.env.NAVER_CALLBACK_URL || 'not-set',
  });
});

// 구글 콜백
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/api/auth/failure' }),
  (req, res) => {
    try {
      const user = req.user;
      
      // JWT 토큰 생성
      const token = jwt.sign(
        { userId: user._id, email: user.email },
        jwtSecret,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      // 사용자 정보를 쿼리 파라미터로 전달
      const userData = {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        profileImage: user.profileImage,
        socialProvider: user.socialProvider,
        createdAt: user.createdAt
      };

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const redirectUrl = `${frontendUrl}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify(userData))}`;
      
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('구글 로그인 콜백 오류:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent('로그인 처리 중 오류가 발생했습니다.')}`);
    }
  }
);

// 로그인 실패 처리
router.get('/failure', (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent('소셜 로그인에 실패했습니다.')}`);
});

// ============================================
// 일반 로그인/회원가입 (이메일)
// ============================================

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const User = require('../models/User');
    const bcrypt = require('bcryptjs');

    // 이메일로 사용자 찾기 (비밀번호 필드 포함)
    const user = await User.findOne({ email, socialProvider: 'local' }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: '이메일 또는 비밀번호가 올바르지 않습니다.'
      });
    }

    // 비밀번호 확인
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: '이메일 또는 비밀번호가 올바르지 않습니다.'
      });
    }

    // JWT 토큰 생성
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // 마지막 로그인 시간 업데이트
    user.lastLogin = new Date();
    await user.save();

    res.json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        profileImage: user.profileImage,
        socialProvider: user.socialProvider
      }
    });
  } catch (error) {
    console.error('로그인 오류:', error);
    res.status(500).json({
      success: false,
      error: '로그인 처리 중 오류가 발생했습니다.'
    });
  }
});

// 회원가입
router.post('/signup', async (req, res) => {
  try {
    const { email, password, username } = req.body;
    const User = require('../models/User');
    const bcrypt = require('bcryptjs');

    // 이메일 중복 확인
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: '이미 사용 중인 이메일입니다.'
      });
    }

    // 비밀번호 해시화
    const hashedPassword = await bcrypt.hash(password, 10);

    // 새 사용자 생성
    const user = new User({
      email,
      password: hashedPassword,
      username,
      socialProvider: 'local'
    });

    await user.save();

    // JWT 토큰 생성
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        profileImage: user.profileImage,
        socialProvider: user.socialProvider
      }
    });
  } catch (error) {
    console.error('회원가입 오류:', error);
    res.status(500).json({
      success: false,
      error: '회원가입 처리 중 오류가 발생했습니다.'
    });
  }
});

// 사용자 정보 조회 (JWT 토큰으로) — 신뢰지수(다른 사용자가 정확해요 누른 합계) 포함
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: '인증 토큰이 필요합니다.'
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, jwtSecret);

    const User = require('../models/User');
    const Post = require('../models/Post');
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: '사용자를 찾을 수 없습니다.'
      });
    }

    let trustScore = 0;
    try {
      const userPosts = await Post.find({ user: user._id }).select('accuracyCount').lean();
      trustScore = userPosts.filter((p) => (p.accuracyCount || 0) >= 1).length;
    } catch (e) {
      // 무시
    }

    res.json({
      success: true,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        profileImage: user.profileImage,
        socialProvider: user.socialProvider,
        trustScore
      }
    });
  } catch (error) {
    console.error('사용자 정보 조회 오류:', error);
    res.status(401).json({
      success: false,
      error: '유효하지 않은 토큰입니다.'
    });
  }
});

// 로그아웃
router.post('/logout', (req, res) => {
  // JWT는 클라이언트에서 제거하면 되므로 서버에서는 성공 응답만
  res.json({
    success: true,
    message: '로그아웃되었습니다.'
  });
});

module.exports = router;

