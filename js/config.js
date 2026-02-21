// js/config.js
// IMPORTANT: Replace these with your actual Supabase project credentials
const SUPABASE_URL = 'https://kechmfekacwpplzogjue.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_p1lITBsEZxM7tCUdO42ShA_FAIvo57F';

const MAX_IMAGES_PER_POST = 2;
const MAX_POSTS_PER_DAY = 4;
const MAX_IMAGE_SIZE_BYTES = 3 * 1024 * 1024;
```

For the `SUPABASE_ANON_KEY` — go to:
**Supabase → Project Settings → API Keys → copy the Publishable key** (`sb_publishable_...`)

---

Once you save that file, **upload it to GitHub**:
1. Go to your GitHub repo → open `js` folder → click `config.js`
2. Click the **pencil icon** ✏️ (Edit)
3. Replace the content with the updated code above
4. Click **Commit changes**

---

Then go to:
```
https://your-krish.github.io/RaisoSpot/
