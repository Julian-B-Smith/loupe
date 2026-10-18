# Writes the build stamp header (fixture case for add_custom_target, Q-009).
file(WRITE ${OUT} "#define FIX_STAMP 1\n")
