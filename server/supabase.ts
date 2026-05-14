import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || "https://yvtdagbiuxmvlesaikts.supabase.co";
const anon = process.env.SUPABASE_ANON_KEY || "sb_publishable_9Wwym8pGkJCa_C1xnDtVBQ_F-QFylwk";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!url || !anon) {
    console.warn('Supabase credentials missing. Cloud persistence disabled.');
    return null;
  }
  try {
    if (!client) {
      client = createClient(url, anon, {
        auth: {
          persistSession: false
        }
      });
      console.log('Supabase Cloud Connection Initialized.');
    }
    return client;
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    return null;
  }
}

export type CloudStaff = {
  id: string;
  name: string;
  staffId: string;
  passkey: string;
  createdBy?: string | null;
  createdAt?: string | null;
};

export type CloudProduct = {
  id: string;
  name: string;
  price: number;
  cost?: number;
  barcode: string;
  category?: string | null;
  image?: string | null;
  quantity?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};
