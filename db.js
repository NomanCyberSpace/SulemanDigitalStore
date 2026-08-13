const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

// Dashboard HTML mein defined Credentials & URLs
const SUPABASE_URL = process.env.SUPABASE_URL || "https://kvcqsmqqcmlbgrtgoeca.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2Y3FzbXFxY21sYmdydGdvZWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMTMwMTksImV4cCI6MjEwMTU4OTAxOX0.BzNIMNu1LhEGAuvm8Wq1ka9hm-n6yq7VNjrO6m2vgdE";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

module.exports = { supabase };