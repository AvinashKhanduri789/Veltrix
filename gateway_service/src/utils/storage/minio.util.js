import { createMinioClient, getMinioBucketName } from '../../config/minio.js';

async function getPresignedCodeUrl(codeStoragePath) {
  const minioClient = createMinioClient();
  const bucket = getMinioBucketName();

  return minioClient.presignedGetObject(bucket, codeStoragePath);
}

async function putCodeObject(objectKey, fileBuffer, fileSize, metaData = {}) {
  const minioClient = createMinioClient();
  const bucket = getMinioBucketName();

  return minioClient.putObject(bucket, objectKey, fileBuffer, fileSize, metaData);
}

async function removeCodeObject(objectKey) {
  const minioClient = createMinioClient();
  const bucket = getMinioBucketName();

  return minioClient.removeObject(bucket, objectKey);
}

export { getPresignedCodeUrl, putCodeObject, removeCodeObject };
