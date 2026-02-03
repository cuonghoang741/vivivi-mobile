
import { createClient } from '@supabase/supabase-js';

// Supabase config
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nechphdcnvhzcshytszt.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lY2hwaGRjbnZoemNzaHl0c3p0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTM1OTM3NSwiZXhwIjoyMDg0OTM1Mzc1fQ.zM3eE1OAWeq6zIuWLHH50kYANrb8KeYbTU3eofQpKpQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const START = 1;
const END = 3;
const MAX_COSTUME = 2;
const BASE_URL = 'https://pub-4ddc7f7c800a4e5aa8fe879e0f58001f.r2.dev/chars';

function pad3(num: number) {
    return num.toString().padStart(3, '0');
}

function pad2(num: number) {
    return num.toString().padStart(2, '0');
}

const NAMES = [
    'Aiko', 'Yuki', 'Sakura', 'Hana', 'Rina',
    'Mio', 'Sora', 'Kaira', 'Luna', 'Maya',
    'Nina', 'Elena', 'Zara', 'Kyra', 'Lila',
    'Aria', 'Cleo', 'Iris', 'Nova', 'Ruby'
];

function getRandomName() {
    return NAMES[Math.floor(Math.random() * NAMES.length)];
}

async function main() {
    console.log('Starting character update/import (V4)...');

    // 1. Fetch Template Character (Order "001")
    // 1. Fetch Template Character (Order "001")
    console.log('🔍 Fetching template character (order "001")...');
    const { data: allChars, error: tplError } = await supabase
        .from('characters')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100);

    let templateChar = allChars?.find(c => c.order === '001' || c.order === 1 || c.order === '1');
    if (!templateChar) {
        // Try searching by name if really desperate? "Emmie"?
        templateChar = allChars?.find(c => c.name === 'Emmie');
    }

    if (tplError || !templateChar) {
        console.error('❌ Could not find template character with order "001"!', tplError?.message);
        return;
    }
    console.log(`✅ Template found: ${templateChar.name} (ID: ${templateChar.id}, Order: ${templateChar.order})`);

    // Prepare template props
    const {
        id: _tid, created_at: _tca, updated_at: _tua, name: _tn,
        thumbnail_url: _tthumb, avatar: _tav, base_model_url: _tbase,
        video_url: _tvid, default_costume_id: _tdc, order: _to, agent_elevenlabs_id: _tagent,
        ...templateProps
    } = templateChar;

    for (let i = START; i <= END; i++) {
        const charNum = pad3(i); // "003", "004"...
        const TARGET_ORDER = charNum; // "003" string

        // Also consider legacy numeric index if any (3 vs "003")
        const legacyOrder = i;
        const legacyOrderStr = i.toString();

        console.log(`\n-----------------------------------`);
        console.log(`Processing Order ${TARGET_ORDER}...`);

        // Check if character with this order exists (checking "003" and "3")
        const { data: existingChars, error: searchError } = await supabase
            .from('characters')
            .select('id, name, order')
            .or(`order.eq.${TARGET_ORDER},order.eq.${legacyOrderStr}`)
            .limit(1);

        // Note: .or() expects simple equality syntax. 

        let existingChar = existingChars?.[0];

        // Fallback: if user has `order` as int in DB, searching for "3" might work or might need numeric check?
        // Since we know column is string, "3" and "003" are distinct. 

        const thumb01 = `${BASE_URL}/${charNum}/thumb/${charNum}_01.png`;
        const avatar = `${BASE_URL}/${charNum}/thumb/${charNum}_avatar.png`;
        const vrm01 = `${BASE_URL}/${charNum}/vrm/${charNum}_01.vrm`;

        let charId;
        let isUpdate = false;

        const commonPayload = {
            ...templateProps,
            description: `Character ${charNum}`,
            thumbnail_url: thumb01,
            avatar: avatar,
            base_model_url: vrm01,
            is_public: true,
            available: true,
            background_default_id: templateChar.background_default_id
        };

        if (existingChar) {
            console.log(`Found existing character: ${existingChar.name} (${existingChar.id}) Order: ${existingChar.order}`);
            console.log(`⏩ Updating existing character to order ${TARGET_ORDER}...`);

            const updatePayload = {
                ...commonPayload,
                name: getRandomName(),
                order: TARGET_ORDER, // Ensure it becomes "003" if it was "3"
            };

            const { error: updateError } = await supabase
                .from('characters')
                .update(updatePayload)
                .eq('id', existingChar.id);

            if (updateError) {
                console.error(`❌ Update failed:`, updateError.message);
                continue;
            }

            charId = existingChar.id;
            isUpdate = true;
            console.log(`✅ Updated character ${charId}`);

        } else {
            console.log(`🆕 Creating new character with order ${TARGET_ORDER}...`);

            const insertPayload = {
                ...commonPayload,
                name: getRandomName(),
                order: TARGET_ORDER,
                default_costume_id: null
            };

            const { data: newChar, error: insertError } = await supabase
                .from('characters')
                .insert(insertPayload)
                .select()
                .single();

            if (insertError) {
                console.error(`❌ Insert failed:`, insertError.message);
                continue;
            }
            charId = newChar.id;
            console.log(`✅ Created character ${charId}`);
        }

        // Check costumes one by one (update or insert)
        console.log(`   Processing costumes for char ${charId}...`);

        const createdCostumeIds = [];

        for (let c = 1; c <= MAX_COSTUME; c++) {
            const costNum = pad2(c);
            const costumeName = `Outfit ${costNum}`;
            // Note: prompt said "Costume 1" but existing logic used "Outfit 01".
            // Since we are "updating or inserting", we stick to our generated naming for consistency if exists.

            const cThumb = `${BASE_URL}/${charNum}/thumb/${charNum}_${costNum}.png`;
            const cVrm = `${BASE_URL}/${charNum}/vrm/${charNum}_${costNum}.vrm`;

            // Check if costume exists by name for this character
            const { data: existingCostumes } = await supabase
                .from('character_costumes')
                .select('id')
                .eq('character_id', charId)
                .eq('costume_name', costumeName)
                .limit(1);

            const existingCostume = existingCostumes?.[0];

            const costumePayload = {
                character_id: charId,
                costume_name: costumeName,
                thumbnail: cThumb,
                model_url: cVrm,
                url: cVrm,
                available: true,
                tier: 'free',
                // price_vcoin/ruby commented out as before
            };

            let finalCostumeId;

            if (existingCostume) {
                // Update
                const { error: updateCostumeError } = await supabase
                    .from('character_costumes')
                    .update(costumePayload)
                    .eq('id', existingCostume.id);

                if (updateCostumeError) {
                    console.error(`      ❌ Failed to update ${costumeName}:`, updateCostumeError.message);
                } else {
                    // console.log(`      ✅ Updated ${costumeName}`);
                    finalCostumeId = existingCostume.id;
                }
            } else {
                // Insert
                const { data: newCostume, error: insertCostumeError } = await supabase
                    .from('character_costumes')
                    .insert(costumePayload)
                    .select()
                    .single();

                if (insertCostumeError) {
                    console.error(`      ❌ Failed to insert ${costumeName}:`, insertCostumeError.message);
                } else {
                    // console.log(`      ✅ Created ${costumeName}`);
                    finalCostumeId = newCostume.id;
                }
            }

            if (finalCostumeId) createdCostumeIds.push(finalCostumeId);
        }

        // Final Step: Update default_costume_id
        // "update lại nhân vật vừa tạo giá trị default_costume_id luôn là record có model url là ..._01.vrm"
        const targetDefaultVrm = `${BASE_URL}/${charNum}/vrm/${charNum}_01.vrm`;

        const { data: defaultCostumeRecord } = await supabase
            .from('character_costumes')
            .select('id')
            .eq('character_id', charId)
            .eq('model_url', targetDefaultVrm)
            .limit(1)
            .single();

        if (defaultCostumeRecord) {
            await supabase
                .from('characters')
                .update({ default_costume_id: defaultCostumeRecord.id })
                .eq('id', charId);
            console.log(`   ✅ Set default costume to ${defaultCostumeRecord.id} (matches _01.vrm)`);
        } else {
            console.warn(`   ⚠️ Could not find costume with model_url ending in _01.vrm to set as default.`);
        }

    }
    console.log('\nProcess complete!');
}

main().catch(console.error);
