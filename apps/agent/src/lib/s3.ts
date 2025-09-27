import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getClient() {
  const region = process.env.AWS_REGION ?? "eu-west-1";
  const endpoint = process.env.S3_ENDPOINT;
  const creds = process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
    ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
    : undefined;
  return new S3Client({
    region,
    endpoint,
    forcePathStyle: Boolean(endpoint),
    credentials: creds,
  });
}

export async function uploadObject(params: { key: string; body: string | Uint8Array; contentType?: string; encoding?: "base64" | "utf-8" }) {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET manquant");
  const client = getClient();
  let Body: Uint8Array | Buffer | string = params.body;
  if (typeof params.body === "string" && params.encoding === "base64") {
    Body = Buffer.from(params.body, "base64");
  }
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: params.key,
    Body,
    ContentType: params.contentType,
  }));
}

export async function getSignedGetUrl(key: string, ttlSeconds?: number) {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET manquant");
  const client = getClient();
  const seconds = ttlSeconds ?? Number(process.env.SIGNED_URL_TTL ?? 86400);
  const getCommand = new GetObjectCommand({ Bucket: bucket, Key: key });
  return await getSignedUrl(client, getCommand, { expiresIn: seconds });
}
