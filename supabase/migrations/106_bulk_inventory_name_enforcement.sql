-- ============================================================================
-- SMARTPOS+ v4.0 — BULK INVENTORY: PRODUCT NAME ENFORCEMENT (106)
-- Database-level safeguards to prevent placeholder/empty product names
-- from persisting in bulk_inventory_items and products tables.
-- Execution Order: 4 of 5 (Run AFTER 105_bulk_inventory.sql)
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Validation helper function — centralized name-quality check
--    Returns TRUE if the input string is a real product name, FALSE if it is
--    empty, whitespace-only, or a generated placeholder pattern.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_valid_product_name(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  trimmed TEXT;
BEGIN
  IF p_name IS NULL THEN
    RETURN FALSE;
  END IF;

  trimmed := BTRIM(p_name);

  -- Reject empty / whitespace-only
  IF CHAR_LENGTH(trimmed) = 0 THEN
    RETURN FALSE;
  END IF;

  -- Minimum 2 characters for a real product name
  IF CHAR_LENGTH(trimmed) < 2 THEN
    RETURN FALSE;
  END IF;

  -- Reject "New Item (<barcode>)" / "New Item - <anything>" placeholder pattern
  IF trimmed ~* '^new\s+item[\s\-\(]' THEN
    RETURN FALSE;
  END IF;

  -- Reject "Untitled Product" default placeholder
  IF trimmed ~* '^untitled\s+product' THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. CHECK constraint on bulk_inventory_items.product_name_snapshot
--    Prevents placeholder names at the database layer.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- Drop legacy check if it existed, then add canonical one
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bulk_inventory_items_product_name_snapshot_check'
      AND conrelid = 'public.bulk_inventory_items'::REGCLASS
  ) THEN
    ALTER TABLE public.bulk_inventory_items
      DROP CONSTRAINT bulk_inventory_items_product_name_snapshot_check;
  END IF;
END $$;

ALTER TABLE public.bulk_inventory_items
  ADD CONSTRAINT bulk_inventory_items_product_name_snapshot_check
  CHECK (public.is_valid_product_name(product_name_snapshot));

-- ---------------------------------------------------------------------------
-- 3. CHECK constraint on products.name (reinforce existing NOT NULL)
--    Protects direct inserts that bypass the client-side bulk flow.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_name_quality_check'
      AND conrelid = 'public.products'::REGCLASS
  ) THEN
    ALTER TABLE public.products
      DROP CONSTRAINT products_name_quality_check;
  END IF;
END $$;

ALTER TABLE public.products
  ADD CONSTRAINT products_name_quality_check
  CHECK (public.is_valid_product_name(name));

-- ---------------------------------------------------------------------------
-- 4. CHECK constraint on variants.name (variant names should also be real)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'variants_name_quality_check'
      AND conrelid = 'public.variants'::REGCLASS
  ) THEN
    ALTER TABLE public.variants
      DROP CONSTRAINT variants_name_quality_check;
  END IF;
END $$;

ALTER TABLE public.variants
  ADD CONSTRAINT variants_name_quality_check
  CHECK (public.is_valid_product_name(name));

-- ---------------------------------------------------------------------------
-- 5. Trigger function — produces human-readable error messages with context
--    instead of generic "check constraint violated" on INSERT/UPDATE.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trigger_validate_product_names()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  tbl TEXT;
BEGIN
  tbl := TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME;

  CASE TG_TABLE_NAME
    WHEN 'bulk_inventory_items' THEN
      IF NOT public.is_valid_product_name(NEW.product_name_snapshot) THEN
        RAISE EXCEPTION
          'Invalid product_name_snapshot in %. barcode=%, product_id=%. '
          'Value must not be empty, whitespace, "New Item (...)" or "Untitled Product".',
          tbl, COALESCE(NEW.barcode, '<NULL>'), COALESCE(NEW.product_id::TEXT, '<NULL>')
          USING ERRCODE = 'check_violation';
      END IF;

    WHEN 'products' THEN
      IF NOT public.is_valid_product_name(NEW.name) THEN
        RAISE EXCEPTION
          'Invalid products.name in %. barcode=%, id=%. '
          'Value must not be empty, whitespace, "New Item (...)" or "Untitled Product".',
          tbl, COALESCE(NEW.barcode, '<NULL>'), COALESCE(NEW.id::TEXT, '<NULL>')
          USING ERRCODE = 'check_violation';
      END IF;

    WHEN 'variants' THEN
      IF NOT public.is_valid_product_name(NEW.name) THEN
        RAISE EXCEPTION
          'Invalid variants.name in %. barcode=%, product_id=%, id=%. '
          'Value must not be empty, whitespace, "New Item (...)" or "Untitled Product".',
          tbl, COALESCE(NEW.barcode, '<NULL>'), COALESCE(NEW.product_id::TEXT, '<NULL>'), COALESCE(NEW.id::TEXT, '<NULL>')
          USING ERRCODE = 'check_violation';
      END IF;
  END CASE;

  RETURN NEW;
END;
$$;

-- Attach trigger to bulk_inventory_items (BEFORE INSERT OR UPDATE)
DROP TRIGGER IF EXISTS validate_bulk_inventory_items_name ON public.bulk_inventory_items;
CREATE TRIGGER validate_bulk_inventory_items_name
BEFORE INSERT OR UPDATE OF product_name_snapshot ON public.bulk_inventory_items
FOR EACH ROW
EXECUTE FUNCTION public.trigger_validate_product_names();

-- Attach trigger to products
DROP TRIGGER IF EXISTS validate_products_name ON public.products;
CREATE TRIGGER validate_products_name
BEFORE INSERT OR UPDATE OF name ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.trigger_validate_product_names();

-- Attach trigger to variants
DROP TRIGGER IF EXISTS validate_variants_name ON public.variants;
CREATE TRIGGER validate_variants_name
BEFORE INSERT OR UPDATE OF name ON public.variants
FOR EACH ROW
EXECUTE FUNCTION public.trigger_validate_product_names();

-- ---------------------------------------------------------------------------
-- 6. Performance indexes for name-based lookups (support future search UI)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_bulk_inventory_items_name_gin
  ON public.bulk_inventory_items
  USING GIN (to_tsvector('simple', COALESCE(product_name_snapshot, '')));

CREATE INDEX IF NOT EXISTS idx_products_name_gin
  ON public.products
  USING GIN (to_tsvector('simple', COALESCE(name, '')));

-- ---------------------------------------------------------------------------
-- 7. Verification — audit any existing rows that would violate new checks
--    (non-destructive: just reports them to the migration log)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  bad_bulk INTEGER;
  bad_products INTEGER;
  bad_variants INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_bulk
    FROM public.bulk_inventory_items
    WHERE NOT public.is_valid_product_name(product_name_snapshot);

  SELECT COUNT(*) INTO bad_products
    FROM public.products
    WHERE NOT public.is_valid_product_name(name);

  SELECT COUNT(*) INTO bad_variants
    FROM public.variants
    WHERE NOT public.is_valid_product_name(name);

  IF bad_bulk + bad_products + bad_variants > 0 THEN
    RAISE WARNING
      '[106_bulk_inventory_name_enforcement] Pre-existing invalid rows found: '
      'bulk_inventory_items=%, products=%, variants=%.'
      ' CHECK constraints will REJECT future writes until these are fixed.',
      bad_bulk, bad_products, bad_variants;
  END IF;
END $$;

COMMIT;
