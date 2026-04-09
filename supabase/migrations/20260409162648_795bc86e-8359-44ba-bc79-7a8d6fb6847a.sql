
-- Create reports table
CREATE TABLE public.reportes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id TEXT NOT NULL,
  cliente_nombre TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('general', 'individual')),
  file_name TEXT NOT NULL,
  puesto_id TEXT,
  puesto_nombre TEXT,
  storage_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Allow public access (app uses Firebase auth, not Supabase auth)
ALTER TABLE public.reportes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to reportes" ON public.reportes FOR ALL USING (true) WITH CHECK (true);

-- Create storage bucket for reports
INSERT INTO storage.buckets (id, name, public) VALUES ('reportes', 'reportes', true);

-- Allow public upload/read/delete on the bucket
CREATE POLICY "Allow public upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'reportes');
CREATE POLICY "Allow public read" ON storage.objects FOR SELECT USING (bucket_id = 'reportes');
CREATE POLICY "Allow public delete" ON storage.objects FOR DELETE USING (bucket_id = 'reportes');
