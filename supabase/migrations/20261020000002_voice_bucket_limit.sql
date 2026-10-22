-- ============================================================================
-- Voice bucket limit: 15 MB -> 5 MB
-- ============================================================================
-- Lowers the `voice` Storage bucket upload ceiling to 5 MB (the initial
-- upload limit from the voice-messaging spec). This is the outer backstop;
-- the client and `sendVoiceMessageAction` enforce the same 5 MB bound.
--
-- Reversible: setting file_size_limit back to 15728640 restores v1.
-- ============================================================================

do $$
begin
  update storage.buckets
     set file_size_limit = 5242880 -- 5 MB
   where id = 'voice';
end $$;

-- ---------------------------------------------------------------------------
-- Rollback (manual):
--   update storage.buckets set file_size_limit = 15728640 where id = 'voice';
-- ---------------------------------------------------------------------------
