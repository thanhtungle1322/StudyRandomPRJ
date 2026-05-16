const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// CLOUDINARY_URL env tự động config cloudinary khi có format:
// cloudinary://<api_key>:<api_secret>@<cloud_name>
// Không cần gọi cloudinary.config() thủ công

// Storage cho product images
const productStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'kix/products',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
    },
});

// Storage cho user avatars
const avatarStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'kix/avatars',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 300, height: 300, crop: 'fill', gravity: 'face', quality: 'auto' }],
    },
});

const uploadProductImages = multer({
    storage: productStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
}).array('images', 5);

const uploadAvatar = multer({
    storage: avatarStorage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
}).single('avatar');

module.exports = { cloudinary, uploadProductImages, uploadAvatar };
