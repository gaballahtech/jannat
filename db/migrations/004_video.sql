-- Optional per-product video link (YouTube/TikTok/Instagram/Vimeo/direct URL).
-- Parsed and embedded client-side (see src/lib/video.ts); null = no video.
alter table products add column if not exists video_url text;
