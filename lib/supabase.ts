import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qmgyzbrykzbyyqddyyrd.supabase.co';
const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtZ3l6YnJ5a3pieXlxZGR5eXJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0Mjk4NzUsImV4cCI6MjA4NzAwNTg3NX0.aH4766y6l0iJtONRz3IyjKiO5xOWlNymSVbHfJ362gU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface DBTemplate {
    id: string;
    name: string;
    mjml: string;
    elements: unknown;
    created_at: string;
    updated_at: string;
}

export interface DBTemplateHistory {
    id: string;
    template_id: string;
    name: string;
    mjml: string;
    elements: unknown;
    created_at: string;
}
