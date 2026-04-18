const cloudinary = require('cloudinary').v2;

// Cloudinary 설정 (환경 변수 사용)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * multer-storage-cloudinary 대체: Cloudinary v2 SDK만 사용해 구버전 cloudinary 패키지 의존을 제거합니다.
 * Multer StorageEngine — https://github.com/expressjs/multer#storageengine
 */
class CloudinaryMulterStorage {
  constructor(options) {
    this.cloudinary = options.cloudinary || cloudinary;
    this.params = options.params || {};
  }

  _handleFile(req, file, cb) {
    const p = this.params;
    const uploadOpts = {
      folder: p.folder,
      transformation: p.transformation,
      resource_type: p.resource_type || 'image',
    };

    const stream = this.cloudinary.uploader.upload_stream(uploadOpts, (err, result) => {
      if (err) return cb(err);
      return cb(null, {
        path: result.secure_url,
        filename: result.public_id,
      });
    });

    file.stream.pipe(stream);
  }

  _removeFile(req, file, cb) {
    cb(null);
  }
}

// Multer Storage 설정 (이미지 전용)
const storage = new CloudinaryMulterStorage({
  cloudinary,
  params: {
    folder: 'livejourney/posts',
    transformation: [{ width: 1280, height: 1280, crop: 'limit' }],
  },
});

// 비디오용 Storage 설정 (옵션)
const videoStorage = new CloudinaryMulterStorage({
  cloudinary,
  params: {
    folder: 'livejourney/videos',
    resource_type: 'video',
  },
});

module.exports = {
  cloudinary,
  storage,
  videoStorage,
};
