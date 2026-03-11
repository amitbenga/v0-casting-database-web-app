import { v4 as uuidv4 } from 'uuid';

export type R2MediaFolder = 'photos' | 'voice-samples' | 'singing-samples' | 'documents';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function normalizeMimeType(mimeType: string): string {
    const mimeMap: Record<string, string> = {
        "audio/x-m4a": "audio/mp4",
        "audio/m4a": "audio/mp4",
        "audio/mp3": "audio/mpeg",
        "audio/x-wav": "audio/wav",
    };
    return mimeMap[mimeType] || mimeType;
}

function getFileExtension(mimeType: string): string {
    const extMap: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
        "audio/mpeg": "mp3",
        "audio/wav": "wav",
        "audio/mp4": "m4a",
        "audio/ogg": "ogg",
        "audio/aac": "aac",
        "audio/webm": "webm",
    };
    return extMap[mimeType] || "bin";
}

export async function uploadFileToR2(
    file: File,
    folder: R2MediaFolder,
    actorId: string = "unassigned"
): Promise<{ objectKey: string | null; error: string | null }> {
    try {
        if (file.size > MAX_FILE_SIZE) {
            return { objectKey: null, error: "הקובץ גדול מדי (מקסימום 10MB)" };
        }

        const normalizedMime = normalizeMimeType(file.type);
        const ext = getFileExtension(normalizedMime);
        const timestamp = Date.now();
        const uuid = uuidv4();
        const uploadFilename = `${uuid}-${timestamp}.${ext}`;

        const normalizedBlob = new Blob([file], { type: normalizedMime });

        const urlResponse = await fetch(`/api/upload`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                folder,
                submissionId: actorId,
                filename: uploadFilename,
                contentType: normalizedMime,
            }),
        });

        if (!urlResponse.ok) {
            const data = await urlResponse.json().catch(() => ({}));
            return { objectKey: null, error: data.error || `Failed to get upload URL (${urlResponse.status})` };
        }

        const { uploadUrl, objectKey } = await urlResponse.json();

        const uploadResponse = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": normalizedMime },
            body: normalizedBlob,
        });

        if (!uploadResponse.ok) {
            return { objectKey: null, error: `העלאה נכשלה (R2 status ${uploadResponse.status})` };
        }

        return { objectKey, error: null };
    } catch (err: any) {
        return { objectKey: null, error: `שגיאה בהעלאת הקובץ: ${err?.message || 'Unknown'}` };
    }
}
