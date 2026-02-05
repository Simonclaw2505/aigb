-- Force PostgREST to reload schema cache by notifying
NOTIFY pgrst, 'reload schema';