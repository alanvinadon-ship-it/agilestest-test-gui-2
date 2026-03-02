#!/usr/bin/env python3
"""Auto-answer drizzle-kit generate prompts with Enter (always pick first option = create column)."""
import subprocess
import time
import sys
import os

proc = subprocess.Popen(
    ["npx", "drizzle-kit", "generate"],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    text=True,
    bufsize=1,
)

output = []
buffer = ""

while True:
    char = proc.stdout.read(1)
    if not char:
        break
    buffer += char
    if char == "\n":
        output.append(buffer.rstrip())
        print(buffer.rstrip(), flush=True)
        buffer = ""
    # Detect prompt: "create column" is the first option (selected by default)
    if "create column" in buffer or "create table" in buffer:
        time.sleep(0.2)
        proc.stdin.write("\n")
        proc.stdin.flush()
        output.append(buffer.rstrip())
        print(buffer.rstrip(), flush=True)
        buffer = ""

proc.wait()
if buffer:
    print(buffer.rstrip(), flush=True)

sys.exit(proc.returncode)
