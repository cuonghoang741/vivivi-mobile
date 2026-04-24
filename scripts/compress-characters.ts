import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://cjtghurczxqheqwegpiy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SOURCE_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqdGdodXJjenhxaGVxd2VncGl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM4MDAxMCwiZXhwIjoyMDc4OTU2MDEwfQ.1gDh3kIlmhl68xAvRO9QUBJxtWcP-UTZ7HINjE1t8zA';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function processCharacters() {
    console.log('🔄 Starting character thumbnail and avatar compression processing...');

    let hasMore = true;
    let offset = 0;
    const limit = 50;

    while (hasMore) {
        console.log(`Fetching characters from offset ${offset}...`);
        const { data: characters, error } = await supabase
            .from('characters')
            .select('id, name, thumbnail_url, avatar')
            .range(offset, offset + limit - 1);

        if (error) {
            console.error('❌ Error fetching characters:', error.message);
            break;
        }

        if (!characters || characters.length === 0) {
            hasMore = false;
            break;
        }

        for (const char of characters) {
            let updatePayload: any = {};
            let isUpdateNeeded = false;

            // Thumbnail (size width 500 => w=500)
            if (char.thumbnail_url && !char.thumbnail_url.includes('cdn-cgi/image')) {
                // If the url is already CDN but doesn't have image resizing
                if (char.thumbnail_url.includes('pub-6671ed00c8d945b28ff7d8ec392f60b8.r2.dev')) {
                     const originalPath = char.thumbnail_url.replace('https://pub-6671ed00c8d945b28ff7d8ec392f60b8.r2.dev', '');
                     updatePayload.thumbnail_url = `https://vivivi.colorme.vn/cdn-cgi/image/width=500,quality=75,format=auto${originalPath}`;
                     isUpdateNeeded = true;
                } else if (char.thumbnail_url.includes('vivivi.colorme.vn') && !char.thumbnail_url.includes('/cdn-cgi/image')) {
                     const originalPath = char.thumbnail_url.replace('https://vivivi.colorme.vn', '');
                     updatePayload.thumbnail_url = `https://vivivi.colorme.vn/cdn-cgi/image/width=500,quality=75,format=auto${originalPath}`;
                     isUpdateNeeded = true;
                }
            }

            // Avatar (Avatar => small_avatar_url)
            // Need to update the small_avatar_url field based on the avatar field
            if (char.avatar) {
                 if (char.avatar.includes('pub-6671ed00c8d945b28ff7d8ec392f60b8.r2.dev')) {
                     const originalPath = char.avatar.replace('https://pub-6671ed00c8d945b28ff7d8ec392f60b8.r2.dev', '');
                     updatePayload.small_avatar_url = `https://vivivi.colorme.vn/cdn-cgi/image/width=150,quality=75,format=auto${originalPath}`;
                     isUpdateNeeded = true;
                 } else if (char.avatar.includes('vivivi.colorme.vn') && !char.avatar.includes('/cdn-cgi/image')) {
                     const originalPath = char.avatar.replace('https://vivivi.colorme.vn', '');
                     updatePayload.small_avatar_url = `https://vivivi.colorme.vn/cdn-cgi/image/width=150,quality=75,format=auto${originalPath}`;
                     isUpdateNeeded = true;
                 }
            }

            if (isUpdateNeeded) {
                console.log(`Updating character: ${char.name} (${char.id})`);
                const { error: updateError } = await supabase
                    .from('characters')
                    .update(updatePayload)
                    .eq('id', char.id);

                if (updateError) {
                    console.error(`❌ Failed to update ${char.name}:`, updateError.message);
                } else {
                    console.log(`✅ Updated ${char.name}`);
                }
            }
        }
        offset += limit;
    }
    console.log('🎉 Character thumbnail and small avatar processing complete!');
}

processCharacters().catch(console.error);

