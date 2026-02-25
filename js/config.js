// js/config.js
const SUPABASE_URL = 'https://kechmfekacwpplzogjue.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlY2htZmVrYWN3cHBsem9nanVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NjQ0MTgsImV4cCI6MjA4NzI0MDQxOH0.o_b_m8ePikwZSgfDOx68IXMbodbPfxzuCZ4viCW36Gk';

const MAX_IMAGES_PER_POST = 2;
const MAX_POSTS_PER_DAY = 4;
const MAX_IMAGE_SIZE_BYTES = 3 * 1024 * 1024;

// Use var to avoid redeclaration errors if script is loaded twice
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
