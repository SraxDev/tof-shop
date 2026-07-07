import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kvwkjggnmbgdhvxcdgbq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2d2tqZ2dubWJnZGh2eGNkZ2JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNzA2NTYsImV4cCI6MjA5ODk0NjY1Nn0.r8uMpNzQFNMjSnjWhxEnEBqF17EEu50lb9Df2StTlT0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
