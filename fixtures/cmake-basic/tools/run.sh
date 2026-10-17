#!/bin/sh
# Regenerates the table by hand (never run by the crawler).
source tools/env.sh
python3 tools/gen_table.py out.h
cat tools/presets.in > data/presets.json
