import multer from 'multer';

const MAX_FILE_SIZE_BYTES = Number(process.env.MAX_FUNCTION_FILE_SIZE_BYTES || 5 * 1024 * 1024);

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  const lowerName = String(file.originalname || '').toLowerCase();
  const isAllowed = lowerName.endsWith('.py') || lowerName.endsWith('.js') || lowerName.endsWith('.go');

  if (!isAllowed) {
    const error = new Error('Invalid request payload');
    error.statusCode = 400;
    error.errorCode = 'INVALID_REQUEST_PAYLOAD';
    return cb(error);
  }

  return cb(null, true);
}

const uploadFunctionSource = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
  fileFilter,
}).single('file');

export { uploadFunctionSource };
