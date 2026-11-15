alter table public.routine_journals drop constraint routine_journals_document_check;
alter table public.routine_journals add constraint routine_journals_document_check check (coalesce(
  jsonb_typeof(document) = 'object' and document->>'version' = '1'
  and jsonb_typeof(document->'routines') = 'array'
  and jsonb_typeof(document->'days') = 'object'
  and jsonb_typeof(document->'weeks') = 'object'
  and octet_length(document::text) <= 5242880,
  false
));
