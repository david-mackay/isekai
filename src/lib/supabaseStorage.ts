import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

function getSupabaseS3Config() {
  const endpoint = process.env.SUPABASE_BUCKET_ENDPOINT;
  const accessKeyId = process.env.SUPABASE_BUCKET_ACCESS_KEY_ID;
  const secretAccessKey = process.env.SUPABASE_BUCKET_SECRET;
  const region = process.env.REGION || "us-east-1";

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing Supabase S3 configuration. Required: SUPABASE_BUCKET_ENDPOINT, SUPABASE_BUCKET_ACCESS_KEY_ID, SUPABASE_BUCKET_SECRET"
    );
  }

  return { endpoint, accessKeyId, secretAccessKey, region };
}

export async function uploadImageToSupabase(
  imageData: Buffer | Uint8Array,
  key: string
): Promise<string> {
  console.log("📤 Image Upload: Starting upload to Supabase", {
    key,
    originalSize: imageData.length,
  });

  const { endpoint, accessKeyId, secretAccessKey, region } =
    getSupabaseS3Config();

  // Upload image as-is (PNG format from image generation API)
  const imageBuffer = Buffer.from(imageData);
  console.log(`📤 Image Upload: Preparing image (${(imageBuffer.length / 1024).toFixed(2)}KB) for upload`);

  const client = new S3Client({
    forcePathStyle: true,
    region,
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  // Extract bucket name from endpoint or use env var
  // Endpoint format: https://project_ref.storage.supabase.co/storage/v1/s3
  // We need the bucket name - it should be in env or we can extract from endpoint
  const bucket = process.env.SUPABASE_BUCKET_NAME || "images";

  // Ensure key ends with .png (images from generation API are PNG format)
  const fileKey = key.endsWith(".png") ? key : `${key}.png`;

  const uploadStartTime = Date.now();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: fileKey,
      Body: imageBuffer,
      ContentType: "image/png",
    })
  );
  const uploadTime = Date.now() - uploadStartTime;
  console.log(`📤 Image Upload: Uploaded to Supabase in ${uploadTime}ms`, {
    bucket,
    key: fileKey,
  });

  // Construct the public URL
  // Supabase Storage public URLs: https://project_ref.supabase.co/storage/v1/object/public/bucket/key
  // Endpoint format: https://project_ref.storage.supabase.co/storage/v1/s3
  // Extract project ref and construct base URL
  const endpointMatch = endpoint.match(/https:\/\/([^.]+)\.storage\.supabase\.co/);
  if (!endpointMatch) {
    throw new Error(`Invalid Supabase endpoint format: ${endpoint}`);
  }
  const projectRef = endpointMatch[1];
  const publicUrl = `https://${projectRef}.supabase.co/storage/v1/object/public/${bucket}/${fileKey}`;

  console.log("📤 Image Upload: Upload complete", {
    publicUrl: publicUrl.substring(0, 100) + "...",
    totalTime: uploadTime + "ms",
  });

  return publicUrl;
}

export async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

