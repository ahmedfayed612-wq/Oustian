p = "src/features/feed/post-card.tsx"
lines = open(p).read().split("\n")

# Replace lines 376-392 (0-indexed 375-391) - the skeleton + img block
# With just a simple img tag
old_start = None
old_end = None
for i, line in enumerate(lines):
    if '{/* Skeleton while the lazy image loads; fades out once loaded. */}' in line:
        old_start = i
    if old_start is not None and line.strip() == '/>' and 'opacity-0' in lines[i-1]:
        old_end = i
        break

print(f"old_start={old_start}, old_end={old_end}")

if old_start is not None and old_end is not None:
    new_block = [
        '                    <img',
        '                      src={item.thumbUrl || item.url}',
        '                      alt={item.altText || ""}',
        '                      loading="lazy"',
        '                      className="size-full object-cover transition duration-300 group-hover:scale-[1.01]"',
        '                    />',
    ]
    lines[old_start:old_end+1] = new_block
    open(p, "w").write("\n".join(lines))
    print("FIXED post-card.tsx")
else:
    print("Could not find block to replace")
