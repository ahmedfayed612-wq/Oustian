/**
 * Verifies the generated Supabase types match the voice-message migration.
 * Run locally after `npm run db:types` so schema drift shows up before CI.
 */
import { readFileSync } from "node:fs";

const types = readFileSync("src/lib/supabase/database.types.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20261016000000_chat_voice_messages.sql",
  "utf8",
);

const required = [
  "type",
  "audio_path",
  "duration_ms",
  "mime_type",
  "file_size_bytes",
  "waveform_data",
];

for (const column of required) {
  if (!types.includes(column)) {
    throw new Error(`database.types.ts is missing the ${column} column`);
  }
  if (!migration.includes(column)) {
    throw new Error(`migration is missing the ${column} column`);
  }
}

for (const sentinel of ["voice", "voice_select", "voice_insert_own"]) {
  if (!migration.includes(sentinel)) {
    throw new Error(`migration is missing ${sentinel}`);
  }
}

console.log("chat voice schema sync: OK");
