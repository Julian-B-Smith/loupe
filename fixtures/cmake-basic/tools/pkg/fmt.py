from . import util       # relative import inside the package (exact)
from .missing import x   # names nothing: a missing node
def row(xs):
    return util.join(xs)
