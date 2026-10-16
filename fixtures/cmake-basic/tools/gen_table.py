"""Writes table.h for the fixture. Run only at build time; the crawler never runs it."""
import sys
with open(sys.argv[1], "w") as f:
    f.write("#pragma once\nstatic const int kTable[] = {1, 2, 3};\n")
