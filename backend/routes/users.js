const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Post = require('../models/Post');
const { getJwtSecret } = require('../config/secrets');

const JWT_SECRET = getJwtSecret();

// JWT에서 현재 사용자 ID 가져오기 (auth 라우트와 동일한 payload: userId)
const getCurrentUserId = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.userId || decoded.id || null;
  } catch {
    return null;
  }
};

// ========== /me 라우트 (/:id 보다 먼저 정의해야 함) ==========

// 내 정보 조회
router.get('/me', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: '인증 토큰이 필요합니다.' });
    }
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, error: '사용자를 찾을 수 없습니다.' });
    }
    res.json({
      success: true,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        profileImage: user.profileImage,
        bio: user.bio,
        socialProvider: user.socialProvider,
        points: user.points,
        level: user.level,
        badges: user.badges || [],
        stats: user.stats,
        settings: user.settings,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    console.error('GET /users/me 오류:', error);
    res.status(500).json({ success: false, error: '사용자 정보 조회에 실패했습니다.' });
  }
});

// 내 프로필 수정
router.put('/me', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: '인증 토큰이 필요합니다.' });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: '사용자를 찾을 수 없습니다.' });
    }
    const { username, profileImage, bio } = req.body;
    if (username !== undefined) user.username = username;
    if (profileImage !== undefined) user.profileImage = profileImage;
    if (bio !== undefined) user.bio = bio;
    await user.save();
    res.json({
      success: true,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        profileImage: user.profileImage,
        bio: user.bio,
        socialProvider: user.socialProvider,
        points: user.points,
        level: user.level,
        badges: user.badges || []
      }
    });
  } catch (error) {
    console.error('PUT /users/me 오류:', error);
    res.status(500).json({ success: false, error: '프로필 수정에 실패했습니다.' });
  }
});

// 계정 삭제
router.delete('/me', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: '인증 토큰이 필요합니다.' });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: '사용자를 찾을 수 없습니다.' });
    }
    user.isActive = false;
    await user.save();
    res.json({ success: true, message: '계정이 비활성화되었습니다.' });
  } catch (error) {
    console.error('DELETE /users/me 오류:', error);
    res.status(500).json({ success: false, error: '계정 삭제에 실패했습니다.' });
  }
});

// 내 뱃지 조회
router.get('/me/badges', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: '인증 토큰이 필요합니다.' });
    }
    const user = await User.findById(userId).select('badges');
    if (!user) {
      return res.status(404).json({ success: false, error: '사용자를 찾을 수 없습니다.' });
    }
    res.json({ success: true, badges: user.badges || [] });
  } catch (error) {
    console.error('GET /users/me/badges 오류:', error);
    res.status(500).json({ success: false, error: '뱃지 조회에 실패했습니다.' });
  }
});

// 알림 설정 변경
router.put('/me/settings/notifications', async (req, res) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: '인증 토큰이 필요합니다.' });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: '사용자를 찾을 수 없습니다.' });
    }
    if (!user.settings) user.settings = {};
    if (!user.settings.notifications) user.settings.notifications = {};
    const { push, email, marketing } = req.body;
    if (push !== undefined) user.settings.notifications.push = push;
    if (email !== undefined) user.settings.notifications.email = email;
    if (marketing !== undefined) user.settings.notifications.marketing = marketing;
    await user.save();
    res.json({ success: true, settings: user.settings });
  } catch (error) {
    console.error('PUT /users/me/settings/notifications 오류:', error);
    res.status(500).json({ success: false, error: '알림 설정 변경에 실패했습니다.' });
  }
});

// ========== 기존 라우트 ==========

// 사용자 목록 조회
router.get('/', (req, res) => {
  res.json({
    success: true,
    users: [],
    message: '사용자 목록 조회 API'
  });
});

// 다른 사용자 공개 프로필 조회 (신뢰지수 포함)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || id === 'me') {
      return res.status(400).json({ success: false, error: '잘못된 요청입니다.' });
    }
    const user = await User.findById(id).select('username profileImage bio').lean();
    if (!user) {
      return res.status(404).json({ success: false, error: '사용자를 찾을 수 없습니다.' });
    }
    let trustScore = 0;
    try {
      const posts = await Post.find({ user: id }).select('accuracyCount').lean();
      trustScore = posts.filter((p) => (p.accuracyCount || 0) >= 1).length;
    } catch (e) {
      // ignore
    }
    res.json({
      success: true,
      user: {
        id: user._id.toString(),
        username: user.username,
        profileImage: user.profileImage,
        bio: user.bio,
        trustScore
      }
    });
  } catch (error) {
    console.error('GET /users/:id 오류:', error);
    res.status(500).json({ success: false, error: '사용자 정보 조회에 실패했습니다.' });
  }
});

// 사용자 정보 수정
router.put('/:id', (req, res) => {
  res.json({
    success: true,
    message: '사용자 정보 수정 API'
  });
});

// 사용자 삭제
router.delete('/:id', (req, res) => {
  res.json({
    success: true,
    message: '사용자 삭제 API'
  });
});

module.exports = router;

