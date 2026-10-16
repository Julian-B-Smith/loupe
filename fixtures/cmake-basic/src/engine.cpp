#include "engine.h"
#include "table.h"
int engine_render(int frames) { return frames * kTable[0] * FIX_RATE; }
