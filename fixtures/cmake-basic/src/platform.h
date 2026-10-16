// Not listed by any target: it is found because engine.h includes it. Each branch's include carries its own guard.
#pragma once
#if defined(__APPLE__)
#include "platform_mac.h"
#elif defined(_WIN32)
#include <windows.h>
#else
#include "platform_posix.h"
#endif
