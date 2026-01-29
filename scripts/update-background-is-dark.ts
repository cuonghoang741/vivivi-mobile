/**
 * Script to analyze all background images and update is_dark field in database
 * 
 * Usage: npx ts-node scripts/update-background-is-dark.ts
 * 
 * Requirements:
 * - SUPABASE_URL and SUPABASE_SERVICE_KEY env variables
 * - npm install sharp (for image processing)
 */

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

// Supabase config - use service key for admin access
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nechphdcnvhzcshytszt.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..zM3eE1OAWeq6zIuWLHH50kYANrb8KeYbTU3eofQpKpQ';

console.log(SUPABASE_URL);
console.log(SUPABASE_SERVICE_KEY);


const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface Background {
  id: string;
  name: string;
  image?: string;
  thumbnail?: string;
  is_dark?: boolean;
}

/**
 * Calculate if an image is dark based on average luminance
 * Uses the formula: luminance = 0.299*R + 0.587*G + 0.114*B
 * Returns true if average luminance < 128 (midpoint of 0-255)
 */
async function isImageDark(imageUrl: string): Promise<boolean> {
  try {
    // Fetch image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Resize to small size for faster processing and get raw pixel data
    const { data, info } = await sharp(buffer)
      .resize(50, 50, { fit: 'cover' }) // Small sample for speed
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixelCount = info.width * info.height;
    let totalLuminance = 0;

    // Calculate average luminance
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Luminance formula (perceived brightness)
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      totalLuminance += luminance;
    }

    const avgLuminance = totalLuminance / pixelCount;

    // Consider dark if average luminance is below midpoint (128)
    // Using 100 as threshold for more reliable "dark" detection
    const isDark = avgLuminance < 100;

    console.log(`  Luminance: ${avgLuminance.toFixed(2)} → ${isDark ? 'DARK' : 'LIGHT'}`);

    return isDark;
  } catch (error) {
    console.error(`  Error analyzing image: ${error}`);
    return true; // Default to dark on error
  }
}

async function main() {
  console.log('🔍 Fetching all backgrounds from database...\n');

  // Fetch all backgrounds
  const { data: backgrounds, error } = await supabase
    .from('backgrounds')
    .select('id, name, image, thumbnail, is_dark')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ Failed to fetch backgrounds:', error);
    process.exit(1);
  }

  if (!backgrounds || backgrounds.length === 0) {
    console.log('No backgrounds found.');
    process.exit(0);
  }

  console.log(`📷 Found ${backgrounds.length} backgrounds\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const bg of backgrounds as Background[]) {
    const imageUrl = bg.image || bg.thumbnail;

    console.log(`[${bg.id}] ${bg.name}`);

    if (!imageUrl) {
      console.log('  ⚠️ No image URL, skipping');
      skipped++;
      continue;
    }

    // Check if already has is_dark set (optional: remove this to force re-analyze)
    // if (bg.is_dark !== null && bg.is_dark !== undefined) {
    //   console.log(`  Already set: ${bg.is_dark ? 'DARK' : 'LIGHT'}, skipping`);
    //   skipped++;
    //   continue;
    // }

    try {
      const isDark = await isImageDark(imageUrl);

      // Update database
      const { error: updateError } = await supabase
        .from('backgrounds')
        .update({ is_dark: isDark })
        .eq('id', bg.id);

      if (updateError) {
        console.log(`  ❌ Failed to update: ${updateError.message}`);
        errors++;
      } else {
        console.log(`  ✅ Updated is_dark = ${isDark}`);
        updated++;
      }
    } catch (err) {
      console.log(`  ❌ Error: ${err}`);
      errors++;
    }

    console.log('');
  }

  console.log('\n📊 Summary:');
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);
}

main().catch(console.error);
