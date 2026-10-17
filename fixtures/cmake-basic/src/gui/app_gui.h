// The GUI bridge: names the web view can call (fixture for the dsp-plugin dialect's bridge rule).
#pragma once
template <class W, class H> void bindAll(W& web, H& host) {
  web.bind("fxGetLevel", [&host](const auto&) { return host.level(); });
  // web.bind("fxNotReal", ...) is a comment: never a registration.
}
