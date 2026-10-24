p = "src/features/feed/post-card.tsx"
lines = open(p).read().split("\n")

# Verify current state (lines 376-389 in the current file)
# Looking for the media div block
for i, line in enumerate(lines):
    if 'aspect-[16/9]' in line:
        print(f"Found aspect-[16/9] at line {i+1}: {line.strip()}")
        # Print surrounding lines
        for j in range(max(0, i-2), min(len(lines), i+20)):
            print(f"  {j+1}: {lines[j]}")
        break
