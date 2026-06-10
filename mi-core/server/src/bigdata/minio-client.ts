/**
 * MinIO client for Mi Big Data object storage.
 * Uses @aws-sdk/client-s3 (S3-compatible API).
 */

import { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import crypto from 'crypto';

const ENDPOINT  = process.env.MINIO_ENDPOINT    || 'http://localhost:9000';
const USER      = process.env.MINIO_ROOT_USER   || 'mi_minio';
const PASSWORD  = process.env.MINIO_ROOT_PASSWORD || '';

export const BUCKETS = {
  RAW:      process.env.MINIO_BUCKET_RAW      || 'mi-raw',
  REPORTS:  process.env.MINIO_BUCKET_REPORTS  || 'mi-reports',
  EVIDENCE: process.env.MINIO_BUCKET_EVIDENCE || 'mi-evidence',
};

export const s3 = new S3Client({
  endpoint:        ENDPOINT,
  region:          'us-east-1',
  credentials:     { accessKeyId: USER, secretAccessKey: PASSWORD },
  forcePathStyle:  true,
});

export async function isMinioAvailable(): Promise<boolean> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKETS.RAW }));
    return true;
  } catch (e: unknown) {
    // 404 means bucket missing but Minio IS up
    const code = (e as { name?: string })?.name;
    if (code === 'NoSuchBucket' || code === '404') return true;
    return false;
  }
}

export async function ensureBucket(bucket: string): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}

export async function ensureAllBuckets(): Promise<void> {
  await Promise.all(Object.values(BUCKETS).map(ensureBucket));
}

export async function putObject(
  bucket: string,
  key: string,
  body: Buffer | string,
  contentType = 'application/octet-stream'
): Promise<{ key: string; checksum: string; size: number }> {
  const buf = typeof body === 'string' ? Buffer.from(body, 'utf-8') : body;
  const checksum = crypto.createHash('sha256').update(buf).digest('hex');

  await s3.send(new PutObjectCommand({
    Bucket:      bucket,
    Key:         key,
    Body:        buf,
    ContentType: contentType,
    Metadata:    { checksum },
  }));

  return { key, checksum, size: buf.length };
}

export async function getObject(bucket: string, key: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const stream = res.Body as Readable;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export function buildObjectKey(sourceId: number | string, objectType: string, filename: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `source_${sourceId}/${date}/${objectType}/${safe}`;
}
