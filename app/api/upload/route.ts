import { NextResponse } from "next/server";

const ALLOWED_CONTENT_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "audio/mpeg",
    "audio/wav",
    "audio/mp4",
    "audio/ogg",
    "video/mp4",
    "video/webm",
])

export async function POST(req: Request) {
    try {
        const { folder, submissionId, filename, contentType } = await req.json();

        if (!folder || !submissionId || !filename || !contentType) {
            return NextResponse.json(
                { error: "Missing required parameters (folder, submissionId, filename, contentType)" },
                { status: 400 }
            );
        }

        // Validate inputs to prevent path traversal
        if (/[\/\\\.]{2}/.test(folder) || /[\/\\]/.test(folder)) {
            return NextResponse.json({ error: "Invalid folder name" }, { status: 400 });
        }
        if (/[\/\\\.]{2}/.test(submissionId)) {
            return NextResponse.json({ error: "Invalid submissionId" }, { status: 400 });
        }
        if (/[\/\\\.]{2}/.test(filename)) {
            return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
        }

        // Validate content type against allowlist
        if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
            return NextResponse.json(
                { error: `Content type not allowed: ${contentType}` },
                { status: 400 }
            );
        }

        const accountId = process.env.R2_ACCOUNT_ID;
        const accessKeyId = process.env.R2_ACCESS_KEY_ID;
        const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
        const bucketName = process.env.R2_BUCKET_NAME;

        if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
            console.error("[api/upload] R2 credentials missing in environment variables.");
            return NextResponse.json(
                { error: "Server formulation error: Storage configuration is missing." },
                { status: 500 }
            );
        }

        // Dynamic imports to prevent build issues with older next versions
        const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
        const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

        const s3Client = new S3Client({
            region: "auto",
            endpoint: process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        });

        const objectKey = `actor-submissions/${submissionId}/${folder}/${filename}`;

        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
            ContentType: contentType,
        });

        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

        return NextResponse.json({ uploadUrl, objectKey });
    } catch (error: any) {
        console.error("[api/upload] Error generating presigned URL:", error);
        return NextResponse.json(
            { error: `Failed to generate upload URL: ${error?.message || 'Unknown error'}` },
            { status: 500 }
        );
    }
}
