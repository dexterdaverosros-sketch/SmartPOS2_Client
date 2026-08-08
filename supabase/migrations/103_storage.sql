-- ============================================================================
-- SMARTPOS+ v4.0 — SUPABASE STORAGE BUCKETS (103_storage.sql)
-- Product, Customer, Profile & Report Export Buckets
-- Target: Fresh Empty Supabase PostgreSQL Project
-- Execution Order: 4 of 5 (Run AFTER 102_indexes.sql)
-- ============================================================================

BEGIN;

-- 1. Create Storage Buckets idempotently
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    
    -- Product Images (PUBLIC catalog thumbnails - 5MB Limit)
    INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
    VALUES ('product-images', 'product-images', TRUE, TRUE, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']::text[])
    ON CONFLICT (id) DO UPDATE SET
      public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

    -- Customer Photos (PRIVATE ID Photos - 10MB Limit)
    INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
    VALUES ('customer-photos', 'customer-photos', FALSE, TRUE, 10485760, ARRAY['image/jpeg','image/png','image/webp']::text[])
    ON CONFLICT (id) DO UPDATE SET
      public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

    -- Profile Images (PRIVATE Staff/User Profile Pics - 5MB Limit)
    INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
    VALUES ('profile-images', 'profile-images', FALSE, TRUE, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif']::text[])
    ON CONFLICT (id) DO UPDATE SET
      public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

    -- Report Exports (PRIVATE PDF/CSV/Excel Reports - 50MB Limit)
    INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
    VALUES ('report-exports', 'report-exports', FALSE, FALSE, 52428800, ARRAY['application/pdf','text/csv','application/json','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']::text[])
    ON CONFLICT (id) DO UPDATE SET
      public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

  END IF;
END $$;

-- 2. Attach Storage RLS Policies on storage.objects
-- Note: storage.objects is managed by Supabase with RLS pre-enabled.
-- We create explicit access policies for product images (public read) and service_role (full access).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
    
    -- Public read access policy for product-images bucket
    DROP POLICY IF EXISTS product_images_public_read ON storage.objects;
    CREATE POLICY product_images_public_read ON storage.objects
      FOR SELECT
      USING (bucket_id = 'product-images');

    -- Full access policy for service_role backend operations across all buckets
    DROP POLICY IF EXISTS storage_service_role_access ON storage.objects;
    CREATE POLICY storage_service_role_access ON storage.objects
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');

  END IF;
END $$;

COMMIT;
