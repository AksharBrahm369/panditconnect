-- Permit practical short interview videos while keeping other documents at 10 MB.
ALTER TABLE pim_v2.pandit_documents DROP CONSTRAINT IF EXISTS pandit_documents_size_bytes_check;
ALTER TABLE pim_v2.pandit_documents ADD CONSTRAINT pandit_documents_size_bytes_check CHECK (
  size_bytes > 0 AND (
    (document_type = 'VIDEO_INTERVIEW' AND size_bytes <= 52428800) OR
    (document_type <> 'VIDEO_INTERVIEW' AND size_bytes <= 10485760)
  )
);

UPDATE storage.buckets
SET file_size_limit=52428800,
    allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp','application/pdf','video/mp4','video/webm','video/quicktime']::text[]
WHERE id='pandit-private-documents';
