#include "engine.h"
#include "table.h"
#include "dsp/filter.h"
#include <vector>
#ifdef FIX_EXTRA
#include "missing_extra.h"
#endif
int engine_render(int frames) { return frames * kTable[0] * FIX_RATE; }
