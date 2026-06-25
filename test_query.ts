import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase
    .from('requests')
    .select(`
      id, category, type, start_date, end_date, details, note, priority, attachment_url, status, created_at,
      profiles ( full_name )
    `)
    .limit(1)

  console.log("Without explicit FK:")
  console.log("Error:", error?.message)
  
  const { data: data2, error: error2 } = await supabase
    .from('requests')
    .select(`
      id, category, type, start_date, end_date, details, note, priority, attachment_url, status, created_at,
      profiles!requests_requester_id_fkey ( full_name )
    `)
    .limit(1)

  console.log("\nWith explicit FK (requests_requester_id_fkey):")
  console.log("Error:", error2?.message)

  const { data: data3, error: error3 } = await supabase
    .from('requests')
    .select(`
      id, category, type, start_date, end_date, details, note, priority, attachment_url, status, created_at,
      profiles!requester_id ( full_name )
    `)
    .limit(1)

  console.log("\nWith explicit FK (requester_id):")
  console.log("Error:", error3?.message)
}

run()
