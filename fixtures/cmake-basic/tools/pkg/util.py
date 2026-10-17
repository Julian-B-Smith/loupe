def join(xs):
    return "static const int kTable[] = {%s};\n" % ",".join(map(str, xs))
