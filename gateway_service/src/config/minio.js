import { Client } from 'minio';

function getMinioClientConfig() {
  const endpoint = process.env.MINIO_ENDPOINT;
  const port = Number(process.env.MINIO_PORT);
  const accessKey = process.env.MINIO_ACCESS_KEY;
  const secretKey = process.env.MINIO_SECRET_KEY;

  if (!endpoint || Number.isNaN(port) || !accessKey || !secretKey) {
    throw new Error('Missing MinIO configuration');
  }

  return {
    endPoint: endpoint,
    port,
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey,
    secretKey,
  };
}

function getMinioBucketName() {
  const bucket = process.env.MINIO_BUCKET;
  if (!bucket) {
    throw new Error('MINIO_BUCKET is not set');
  }

  return bucket;
}

function createMinioClient() {
  return new Client(getMinioClientConfig());
}

export { createMinioClient, getMinioBucketName, getMinioClientConfig };
