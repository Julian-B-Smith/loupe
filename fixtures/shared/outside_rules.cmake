# Lives OUTSIDE the fixture repo. Its custom command must not appear in the fixture's facts.
add_custom_command(OUTPUT ${CMAKE_BINARY_DIR}/outside.txt COMMAND ${CMAKE_COMMAND} -E touch ${CMAKE_BINARY_DIR}/outside.txt)
