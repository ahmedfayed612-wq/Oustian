p = "src/features/feed/post-card.tsx"
lines = open(p).read().split("\n")

# Verify line numbers (0-indexed) based on actual file state
assert lines[372].lstrip().startswith('className="relative w-full max-h-[520px] min-h-[160px] overflow-hidden bg-surface-2"'), repr(lines[372])
assert lines[373].strip() == "style={{ aspectRatio: ratio }}", repr(lines[373])
assert lines[374].lstrip() == ">", repr(lines[374])
assert lines[375].lstrip().startswith("{/* eslint"), repr(lines[375])
assert lines[376].strip() == "<img", repr(lines[376])
assert lines[380].strip() == 'className="size-full object-cover transition duration-300 group-hover:scale-[1.01]"', repr(lines[380])
assert lines[381].strip() == "/>", repr(lines[381])

# 1. Replace div className
lines[372] = '                    className="relative w-full aspect-[16/9] max-h-[520px] min-h-[160px] overflow-hidden bg-surface-2/60"'

# 2. Insert placeholder div AFTER the ">" (insert at index 375, before eslint comment at 375)
placeholder = [
    "                    {/* Skeleton while the lazy image loads; fades out once loaded. */}",
    "                    <div",
    '                      aria-hidden="true"',
    '                      className="absolute inset-0 animate-pulse rounded-control bg-muted-decor/30 motion-reduce:animate-none"',
    "                    />",
]
lines[375:375] = placeholder

# 3. Replace img className
lines[380] = '                      className="size-full object-cover transition duration-300 group-hover:scale-[1.01] opacity-0"'

# 4. Add onLoad handler before the /> line
on_load = [
    "                      onLoad={(e) => {",
    '                        const el = e.currentTarget;',
    '                        // Remove the placeholder as soon as the real bytes arrive so',
    '                        // there is never a "blank" region while the image renders.',
    '                        el.style.opacity = "1";',
    "                      })",
]
lines[381:381] = on_load

open(p, "w").write("\n".join(lines))
print("EDITED OK")
