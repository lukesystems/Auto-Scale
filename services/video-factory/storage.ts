import "server-only";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function r2Config() {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.CLOUDFLARE_R2_BUCKET?.trim();
  const publicBaseUrl = process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    return null;
  }
  return { accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl };
}

export function buildGrowthMediaPublicUrl(storagePath: string): string {
  const r2 = r2Config();
  if (!r2) {
    throw new Error(
      "Cloudflare R2 is required for growth media. Set CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, CLOUDFLARE_R2_BUCKET, and CLOUDFLARE_R2_PUBLIC_BASE_URL."
    );
  }
  return `${r2.publicBaseUrl.replace(/\/$/, "")}/${storagePath}`;
}

export async function uploadGrowthMedia(opts: {
  projectId: string;
  growthRunId: string;
  conceptId: string;
  filename: string;
  body: Buffer;
  contentType: string;
}): Promise<{ storagePath: string; publicUrl: string }> {
  const storagePath = `${opts.projectId}/${opts.growthRunId}/${opts.conceptId}/${opts.filename}`;
  const r2 = r2Config();
  if (!r2) {
    throw new Error(
      "Cloudflare R2 is required for growth media uploads. Configure the CLOUDFLARE_R2_* environment variables."
    );
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: r2.accessKeyId,
      secretAccessKey: r2.secretAccessKey,
    },
  });
  await client.send(
    new PutObjectCommand({
      Bucket: r2.bucket,
      Key: storagePath,
      Body: opts.body,
      ContentType: opts.contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return { storagePath, publicUrl: buildGrowthMediaPublicUrl(storagePath) };
}
