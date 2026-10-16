# Loupe crawler fixture (ROADMAP Q-012). Small on purpose: every line exercises one thing the build layer must see.
cmake_minimum_required(VERSION 3.20)
project(Fixture LANGUAGES CXX)

option(FIX_EXTRA "Compile the extra voice (only in the 'extra' configuration)" OFF)

# A header generated at build time by a script: configure records the rule, never runs it.
set(GEN_DIR ${CMAKE_CURRENT_BINARY_DIR}/generated)
add_custom_command(
  OUTPUT ${GEN_DIR}/table.h
  COMMAND python3 ${CMAKE_CURRENT_SOURCE_DIR}/tools/gen_table.py ${GEN_DIR}/table.h
  DEPENDS tools/gen_table.py
  COMMENT "Generating table.h")

add_library(engine STATIC src/engine.cpp src/engine.h ${GEN_DIR}/table.h)
target_include_directories(engine PUBLIC src ${GEN_DIR})
target_compile_definitions(engine PUBLIC FIX_RATE=48000)

# Platform-only and option-only sources: a single configure sees at most some of them.
if(WIN32)
  target_sources(engine PRIVATE src/win_only.cpp)
endif()
if(FIX_EXTRA)
  target_sources(engine PRIVATE src/extra.cpp)
  target_compile_definitions(engine PRIVATE FIX_EXTRA=1)
endif()

add_executable(plugin src/plugin_entry.cpp)
target_link_libraries(plugin PRIVATE engine)

add_executable(engine_test tests/engine_test.cpp)
target_link_libraries(engine_test PRIVATE engine)
