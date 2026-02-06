import { createClient } from '@supabase/supabase-js';

// Supabase config
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nysfrunajmmaoqtppowb.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55c2ZydW5ham1tYW9xdHBwb3diIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDA5MzkxNiwiZXhwIjoyMDg1NjY5OTE2fQ.COiM8r-ha8pr1DZvTdQYCBXYjti-3K_MYLElqBmcEPY';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function getRandomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
    console.log('Starting character stats population with RANDOM values...');

    const { data: characters, error } = await supabase
        .from('characters')
        .select('*');

    if (error || !characters) {
        console.error('Failed to fetch characters:', error);
        return;
    }

    console.log(`Found ${characters.length} characters.`);

    for (const char of characters) {
        const isFree = !char.price_vcoin && !char.price_ruby;

        // 0. Cleanup duplicate costumes
        // Fetch all costumes for this character
        const { data: costumes } = await supabase
            .from('character_costumes')
            .select('id, costume_name, created_at')
            .eq('character_id', char.id)
            .order('created_at', { ascending: true });

        if (costumes && costumes.length > 0) {
            const seenNames = new Set<string>();
            const duplicatesToDelete: string[] = [];

            for (const costume of costumes) {
                if (seenNames.has(costume.costume_name)) {
                    duplicatesToDelete.push(costume.id);
                } else {
                    seenNames.add(costume.costume_name);
                }
            }

            if (duplicatesToDelete.length > 0) {
                console.log(`   🧹 Removing ${duplicatesToDelete.length} duplicate costumes for ${char.name}...`);
                await supabase
                    .from('character_costumes')
                    .delete()
                    .in('id', duplicatesToDelete);
            }
        }

        // 1. Get honest costume count (now clean, available only)
        const { count: realCostumeCount, error: countError } = await supabase
            .from('character_costumes')
            .select('*', { count: 'exact', head: true })
            .eq('character_id', char.id)
            .eq('available', true);

        const costumeCount = (countError || realCostumeCount === null) ? 0 : realCostumeCount;

        // 2. Randomize dances and secrets
        let danceCount, secretCount;
        if (isFree) {
            danceCount = getRandomInt(4, 8);
            secretCount = getRandomInt(1, 2);
        } else {
            danceCount = getRandomInt(12, 30);
            secretCount = getRandomInt(3, 8);
        }

        console.log(`Updating ${char.name}: Costumes=${costumeCount} (Real), Dances=${danceCount}, Secrets=${secretCount}`);

        const { error: updateError } = await supabase
            .from('characters')
            .update({
                total_dances: danceCount,
                total_secrets: secretCount
            })
            .eq('id', char.id);

        if (updateError) {
            console.error(`Failed to update ${char.name}:`, updateError.message);
        }
    }

    console.log('✅ Done! All characters have been updated with random stats.');
}

main().catch(console.error);
