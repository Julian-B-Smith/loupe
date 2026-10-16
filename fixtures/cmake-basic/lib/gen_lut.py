import sys
rows = open(sys.argv[1]).read().split()
open(sys.argv[2], "w").write("#pragma once\nstatic const int kLut[] = {%s};\n" % ",".join(rows))
