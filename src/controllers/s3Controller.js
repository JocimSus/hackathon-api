import { s3, BUCKET } from '../lib/s3.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function createPutPresign(filename, contentType) {
  try {
    const key = `uploads/${Date.now()}-${filename}`;

    const cmd = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType || 'application/octet-stream',
      ACL: 'private'
    });

    const signedUrl = await getSignedUrl(s3, cmd, { expiresIn: 300 });

    return { url: signedUrl, key };
  } catch (err) {
    console.error(err);
    throw new Error('failed to create presign');
  }
}