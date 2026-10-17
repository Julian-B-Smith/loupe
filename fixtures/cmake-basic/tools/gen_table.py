"""Writes table.h for the fixture. Run only at build time; the crawler never runs it."""
import sys
import common            # a sibling module: found next to this file (exact)
import numpy             # not in the repo, not the standard library: a third-party package
from pkg import fmt      # a package beside this file
rows = open("lib/lut.csv").read()   # a data file named by a repo-root path (search)
with open(sys.argv[1], "w") as f:
    f.write(common.header() + fmt.row([1, 2, 3]))
