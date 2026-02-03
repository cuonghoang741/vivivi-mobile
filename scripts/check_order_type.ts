
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nysfrunajmmaoqtppowb.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lY2hwaGRjbnZoemNzaHl0c3p0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTM1OTM3NSwiZXhwIjoyMDg0OTM1Mzc1fQ.zM3eE1OAWeq6zIuWLHH50kYANrb8KeYbTU3eofQpKpQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
    const { data, error } = await supabase.from('characters').select('order').limit(1);
    if (error) console.error(error);
    else console.log('Type of order:', typeof data[0]?.order, 'Value:', data[0]?.order);
}

main();
