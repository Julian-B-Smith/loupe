# Subdirectory of the fixture. Relative paths here are relative to lib/ (sources) and its build dir (outputs).
set(GEN_INPUTS gen_lut.py lut.csv)
add_custom_command(
  OUTPUT lut.h
  BYPRODUCTS lut.log
  COMMAND python3 ${CMAKE_CURRENT_SOURCE_DIR}/gen_lut.py ${CMAKE_CURRENT_SOURCE_DIR}/lut.csv lut.h
  COMMAND ${CMAKE_COMMAND} -E touch lut.log
  DEPENDS ${GEN_INPUTS}
  COMMAND_EXPAND_LISTS
  JOB_POOL console
  COMMENT "Generating lut.h")
add_library(lut STATIC lut.cpp ${CMAKE_CURRENT_BINARY_DIR}/lut.h)
target_include_directories(lut PUBLIC ${CMAKE_CURRENT_BINARY_DIR})
# A post-build step attached to a target (the TARGET form). If configure ever ran it, the marker would appear.
add_custom_command(TARGET lut POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E touch ${CMAKE_CURRENT_SOURCE_DIR}/BUILD_RAN.marker
  COMMENT "post-build marker (must never exist after a crawl)")
# A custom target: CMake adds a pseudo-source for it that is not a project file.
add_custom_target(lut_docs COMMAND ${CMAKE_COMMAND} -E echo lut docs)
