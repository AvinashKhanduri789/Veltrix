import { createHash } from 'node:crypto';
import path from 'node:path';

function sanitizeFileName(fileName) {
  return path.basename(String(fileName || 'source.bin')).replace(/\s+/g, '_');
}

function buildFunctionObjectKey(userId, functionId, versionNumber, originalFileName) {
  return `functions/${userId}/${functionId}/v${versionNumber}/${sanitizeFileName(originalFileName)}`;
}

function hashCodeBuffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export { buildFunctionObjectKey, hashCodeBuffer };
