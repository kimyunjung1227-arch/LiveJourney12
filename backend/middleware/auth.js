const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getJwtSecret } = require('../config/secrets');

// JWT 토큰 생성
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, getJwtSecret(), {
    expiresIn: '30d'
  });
};

// 인증 미들웨어
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // 토큰 추출
      token = req.headers.authorization.split(' ')[1];

      // 토큰 검증
      const decoded = jwt.verify(token, getJwtSecret());

      // 사용자 정보 조회 (비밀번호 제외)
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
      }

      next();
    } catch (error) {
      console.error('토큰 검증 실패:', error);
      return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
    }
  }

  if (!token) {
    return res.status(401).json({ error: '인증 토큰이 필요합니다.' });
  }
};

module.exports = { protect, generateToken };
