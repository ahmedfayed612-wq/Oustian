p = "src/app/[locale]/(app)/chat/[id]/thread.tsx"
lines = open(p).read().split("\n")

# Verify lines (0-indexed)
# Line 258 (1-indexed 259): const idempotencyKey = crypto.randomUUID();
assert lines[257] == '    const idempotencyKey = crypto.randomUUID();', repr(lines[257])
# Line 260 (1-indexed 261): optimistic with idempotency_key
assert 'idempotency_key: idempotencyKey' in lines[259], repr(lines[259])
# Line 264 (1-indexed 265): INSERT with idempotency_key
assert 'idempotency_key: idempotencyKey' in lines[263], repr(lines[263])

# 1. Remove idempotencyKey generation line (257)
# 2. Fix optimistic (259) - remove idempotency_key
lines[259] = '    const optimistic: LocalMsg = { id: tempId, conversation_id: conversationId, sender_id: meId, body: trimmed, created_at: new Date().toISOString(), reply_to_message_id: replyTo?.id ?? null, _pending: true } as LocalMsg;'
# 3. Fix INSERT (263) - remove idempotency_key
lines[263] = '      const { data, error } = await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: meId, body: trimmed, reply_to_message_id: replyTo?.id ?? null }).select().single();'

# Remove the idempotencyKey line (257) and the comment lines (256-258)
# Actually let's remove lines 256-257 (the comment + key generation)
# Line 256: '    // Idempotency key: one per send attempt, retried on failure so a replayed'
# Line 257: '    // insert never creates a duplicate message.'
# Line 258: '    const idempotencyKey = crypto.randomUUID();'

lines[256:258] = []  # Remove comment lines
# After removal, indices shift. But we already modified 259 and 263 which are after 258.
# Let's adjust: we removed 2 lines at 256-257, so everything after shifts by 2.
# But we already modified 259->257 and 263->261. Let me redo this more carefully.

# Actually, let me just rebuild the whole block from line 255 to 264
# Original (1-indexed):
# 255: const tempId = `pending-${Date.now()}`;
# 256: // Idempotency key: one per send attempt, retried on failure so a replayed
# 257: // insert never creates a duplicate message.
# 258: const idempotencyKey = crypto.randomUUID();
# 259: const optimistic: LocalMsg = { ..., idempotency_key: idempotencyKey, ... };
# 260: setMessages(...)
# 261: try {
# 262: const supabase = createClient()...
# 263: const { data, error } = await ...insert({..., idempotency_key: idempotencyKey})...
# 264: setMessages(...)

# New (1-indexed):
# 255: const tempId = `pending-${Date.now()}`;
# 256: const optimistic: LocalMsg = { ..., _pending: true } as LocalMsg;
# 257: setMessages(...)
# 258: try {
# 259: const supabase = createClient()...
# 260: const { data, error } = await ...insert({...})...
# 261: setMessages(...)

# Remove lines 256-258 (0-indexed 255-257): comment + comment + key gen
# Replace line 259 (0-indexed 258): optimistic without idempotency_key
# Replace line 263 (0-indexed 262): INSERT without idempotency_key

# Let me do this step by step
# First, remove lines 256-258 (0-indexed 255-257)
del lines[255:258]
# Now line 258 (0-indexed 257) is the optimistic line, which we need to fix
# And line 262 (0-indexed 261) is the INSERT line

# Fix optimistic (now at index 257)
lines[257] = '    const optimistic: LocalMsg = { id: tempId, conversation_id: conversationId, sender_id: meId, body: trimmed, created_at: new Date().toISOString(), reply_to_message_id: replyTo?.id ?? null, _pending: true } as LocalMsg;'
# Fix INSERT (now at index 261)
lines[261] = '      const { data, error } = await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: meId, body: trimmed, reply_to_message_id: replyTo?.id ?? null }).select().single();'

open(p, "w").write("\n".join(lines))
print("FIXED thread.tsx")
