p = "src/app/[locale]/(app)/chat/[id]/thread.tsx"
lines = open(p).read().split("\n")

# Line 257-259: idempotency key comment + generation
# Line 260: optimistic with idempotency_key
# Line 264: INSERT with idempotency_key
# Line 268-272: error handling for idempotency unique violation

# Verify line 264 (0-indexed 263)
assert "idempotency_key: idempotencyKey" in lines[263], repr(lines[263])

# Replace the INSERT line to remove idempotency_key
lines[263] = '      const { data, error } = await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: meId, body: trimmed, reply_to_message_id: replyTo?.id ?? null }).select().single();'

# Remove the idempotency key generation (lines 257-259, 0-indexed 256-258)
# And remove idempotency_key from optimistic (line 260, 0-indexed 259)
# We'll replace lines 256-260 (0-indexed) with a simpler version
old_block = [
    '    const tempId = `pending-${Date.now()}`;',
    '    // Idempotency key: one per send attempt, retried on failure so a replayed',
    '    // insert never creates a duplicate message.',
    '    const idempotencyKey = crypto.randomUUID();',
    '    const optimistic: LocalMsg = { id: tempId, conversation_id: conversationId, sender_id: meId, body: trimmed, created_at: new Date().toISOString(), reply_to_message_id: replyTo?.id ?? null, idempotency_key: idempotencyKey, _pending: true } as LocalMsg;',
]
new_block = [
    '    const tempId = `pending-${Date.now()}`;',
    '    const optimistic: LocalMsg = { id: tempId, conversation_id: conversationId, sender_id: meId, body: trimmed, created_at: new Date().toISOString(), reply_to_message_id: replyTo?.id ?? null, _pending: true } as LocalMsg;',
]

# Verify
for i, (o, n) in enumerate(zip(old_block, new_block)):
    actual_idx = 256 + i
    assert lines[actual_idx] == o, f"Line {actual_idx+1}: expected {o!r}, got {lines[actual_idx]!r}"

lines[256:261] = new_block

open(p, "w").write("\n".join(lines))
print("FIXED thread.tsx - removed idempotency_key from INSERT")
