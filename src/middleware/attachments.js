import { s3, BUCKET } from '../lib/s3.js';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function getPresignedPut(key, contentType = 'application/octet-stream', expiresIn = 300) {
  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
    ACL: 'private'
  });
  const url = await getSignedUrl(s3, cmd, { expiresIn });
  return { url, key };
}

export async function getPresignedGet(key, expiresIn = 300) {
  const cmd = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key
  });
  const url = await getSignedUrl(s3, cmd, { expiresIn });
  return url;
}

export async function deleteObject(key) {
  const cmd = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key
  });
  return s3.send(cmd);
}