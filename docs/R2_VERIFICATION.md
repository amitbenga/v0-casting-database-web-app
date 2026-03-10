# R2 Storage Migration — Verification Guide

This document provides exact steps to verify that both the **public actor submission form** and the **internal actor edit form** correctly write to and read from Cloudflare R2.

---

## 1. DB Fields by Flow

| Flow | Table | Image Field | Voice Field | Singing Field |
|------|-------|-------------|-------------|---------------|
| **Public submission** (`/intake`) | `actor_submissions` | `image_url` | `voice_sample_url` | `singing_sample_url` |
| **Internal actor edit** (`/actors/[id]`) | `actors` | `image_url` | `voice_sample_url` | `singing_sample_url` |
| **Script upload** (`/projects/[id]` תסריטים tab) | `project_scripts` | — | — | — (`file_url`) |

---

## 2. Upload Routes

| Flow | Client Function | API Route | Server Function |
|------|-----------------|-----------|-----------------|
| Public submission | `uploadFileToR2()` in `lib/r2/upload-client.ts` | `POST /api/upload` | `uploadToR2()` in `lib/r2/upload.ts` |
| Actor edit | Same | Same | Same |
| Script upload | Same | Same | Same |

**Key builders** (in `lib/r2/keys.ts`):
- `actorKeys.image(actorId, filename)` → `actors/{id}/images/{sanitized-filename}`
- `actorKeys.voice(actorId, filename)` → `actors/{id}/voice/{sanitized-filename}`
- `submissionKeys.image(tempId, filename)` → `actor-submissions/{id}/images/{sanitized-filename}`
- `submissionKeys.audio(tempId, filename)` → `actor-submissions/{id}/audio/{sanitized-filename}`
- `scriptKeys.original(projectId, filename)` → `projects/{id}/scripts/original/{sanitized-filename}`

---

## 3. Debug Visibility

### 3.1 Admin Storage Debug Endpoint

```
GET /api/admin/storage-debug
```

Returns JSON showing:
- **Storage type counts** for all actors and submissions (`r2_key`, `base64`, `http_url`, `null`)
- **Sample rows** with truncated field values
- **Expected R2 key patterns**

Example response:
```json
{
  "timestamp": "2026-03-10T...",
  "expected_r2_key_pattern": "actors/{id}/images/{filename}",
  "actors": {
    "total": 15,
    "stats": { "r2_key": 2, "base64": 5, "http_url": 3, "null": 5, "unknown": 0 },
    "samples": [...]
  },
  "submissions": {
    "total": 9,
    "stats": { "r2_key": 1, "base64": 0, "http_url": 0, "null": 26, "unknown": 0 },
    "samples": [...]
  }
}
```

### 3.2 Console Logs (Vercel Function Logs)

After a deploy, check Vercel logs for:
```
[v0] [upload-api] Starting upload: { key: "actors/abc/images/headshot.jpg", fileSize: 102400, fileType: "image/jpeg" }
[v0] [r2] uploadToR2 starting: { bucket: "casting-media", key: "...", contentType: "...", bodyLength: 102400 }
[v0] [r2] uploadToR2 success: { key: "actors/abc/images/headshot.jpg" }
[v0] [upload-api] Upload successful: { key: "actors/abc/images/headshot.jpg" }
```

If upload fails:
```
[v0] [r2] uploadToR2 failed: actors/abc/... Error: ...
[v0] [upload-api] R2 upload failed: ...
```

### 3.3 Browser Network Tab

During upload, watch for:
1. `POST /api/upload` — multipart request with `file` and `key` fields
2. Response: `{ "key": "actors/{id}/images/{filename}" }`

During image/audio display:
1. `GET /api/r2-url?key=actors/{id}/images/{filename}`
2. Response: `{ "url": "https://...r2.cloudflarestorage.com/...?X-Amz-Signature=..." }`
3. Browser then fetches the presigned URL to load the actual asset

---

## 4. Manual Test Steps

### 4.1 Test: New Actor Submission (Public Form)

1. **Navigate** to `/intake` (the public actor submission form)
2. **Fill out** required fields (name, etc.)
3. **Upload a photo** in the photo upload field
4. **Upload a voice sample** in the audio upload field
5. **Submit** the form
6. **Verify in DB**:
   ```sql
   SELECT id, full_name, 
          LEFT(image_url, 80) as image_url_preview,
          LEFT(voice_sample_url, 80) as voice_url_preview
   FROM actor_submissions
   ORDER BY created_at DESC
   LIMIT 1;
   ```
   - `image_url` should start with `actor-submissions/` (R2 key), NOT `data:` or `https://`
   - `voice_sample_url` should start with `actor-submissions/` (R2 key)

7. **Verify in R2 bucket**:
   - Object should exist at path: `actor-submissions/{uuid}/images/{filename}`
   - Object should exist at path: `actor-submissions/{uuid}/audio/{filename}`

8. **Verify display** (if there's a submission review UI):
   - Image should render correctly (browser fetches presigned URL)
   - Audio should play correctly

### 4.2 Test: Actor Edit (Internal App)

1. **Navigate** to `/actors` and select an existing actor
2. **Click edit** to open the edit form
3. **Upload a new photo** using the image upload field
4. **Upload a new voice sample** using the audio upload field
5. **Save** the changes
6. **Verify in DB**:
   ```sql
   SELECT id, full_name,
          LEFT(image_url, 80) as image_url_preview,
          LEFT(voice_sample_url, 80) as voice_url_preview,
          updated_at
   FROM actors
   WHERE id = '<actor-id>'
   ```
   - `image_url` should now be an R2 key like `actors/{id}/images/{filename}`
   - `voice_sample_url` should now be an R2 key like `actors/{id}/voice/{filename}`

7. **Verify in R2 bucket**:
   - New object at `actors/{actor-id}/images/{filename}`
   - New object at `actors/{actor-id}/voice/{filename}`

8. **Verify display**:
   - Refresh the actor profile page
   - Image should load (via presigned URL from `/api/r2-url`)
   - Play button should work (audio fetched via presigned URL)

---

## 5. Expected Outcomes

### 5.1 R2 Bucket

After successful uploads, the bucket should contain objects like:
```
actors/
  {actor-uuid}/
    images/
      headshot.jpg
    voice/
      sample.mp3
actor-submissions/
  {submission-uuid}/
    images/
      photo.jpg
    audio/
      voice.mp3
projects/
  {project-uuid}/
    scripts/
      original/
        script.pdf
```

### 5.2 DB Row Values

**New uploads** will have values like:
- `actors.image_url` = `actors/abc123/images/headshot.jpg`
- `actors.voice_sample_url` = `actors/abc123/voice/sample.mp3`
- `actor_submissions.image_url` = `actor-submissions/def456/images/photo.jpg`

**Old data** (not yet migrated) will still have:
- `data:image/jpeg;base64,...` (Base64)
- `https://ampghzidhlhkabfvheou.supabase.co/storage/v1/object/public/...` (Supabase Storage)

### 5.3 Browser Network Requests

**Upload flow:**
1. `POST /api/upload` → `{ key: "actors/..." }`

**Read flow:**
1. Component calls `useR2Url("actors/...")` hook
2. Hook calls `GET /api/r2-url?key=actors/...`
3. Response: `{ url: "https://...r2.cloudflarestorage.com/...signed..." }`
4. Component uses presigned URL in `<img src>` or `new Audio()`

### 5.4 UI Rendering/Playback

- Images load normally (may take a moment for presigned URL fetch)
- Audio plays via `<audio>` element or `new Audio()` with presigned URL
- For old Base64/Supabase data: `useR2Url` hook passes through unchanged, so display still works

---

## 6. Confirming No New Base64/Supabase Writes

### Code Verification

The following files NO LONGER use `FileReader.readAsDataURL()`:
- `components/actor-edit-form.tsx` — uses `uploadFileToR2()` instead
- `app/intake/page.tsx` — uses `uploadFileToR2()` instead

### Runtime Verification

After any new upload, run:
```sql
-- Should return 0 for new rows
SELECT COUNT(*) 
FROM actors 
WHERE updated_at > NOW() - INTERVAL '1 hour'
  AND (image_url LIKE 'data:%' OR voice_sample_url LIKE 'data:%');

SELECT COUNT(*)
FROM actor_submissions
WHERE created_at > NOW() - INTERVAL '1 hour'
  AND (image_url LIKE 'data:%' OR voice_sample_url LIKE 'data:%');
```

Or use the debug endpoint:
```
GET /api/admin/storage-debug
```
Check that new rows show `type: "r2_key"` not `type: "base64"`.

---

## 7. Troubleshooting

### Upload fails with 401 Unauthorized
- User is not logged in
- Supabase session cookie not present
- `/api/upload` requires authentication

### Upload fails with 500 Internal Server Error
- Check Vercel function logs for `[v0] [r2] uploadToR2 failed`
- Common causes:
  - Missing R2 environment variables
  - Invalid R2 credentials
  - Bucket doesn't exist or wrong name

### Image/audio doesn't load (404 or CORS error)
- Check if the R2 key in DB is correct
- Check if object actually exists in R2 bucket
- Check `/api/r2-url` returns a valid presigned URL
- Presigned URLs expire after 1 hour — refresh if stale

### Old images still work but new ones don't
- Old images use Base64/Supabase URLs (passed through by `useR2Url`)
- New images use R2 keys — check if R2 upload actually succeeded
- Check network tab for `/api/r2-url` calls and responses
