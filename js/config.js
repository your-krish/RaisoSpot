// js/config.js
// IMPORTANT: Replace these with your actual Supabase project credentials
const SUPABASE_URL = 'https://kechmfekacwpplzogjue.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_p1lITBsEZxM7tCUdO42ShA_FAIvo57F';

const MAX_IMAGES_PER_POST = 2;
const MAX_POSTS_PER_DAY = 4;
const MAX_IMAGE_SIZE_BYTES = 3 * 1024 * 1024;

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
