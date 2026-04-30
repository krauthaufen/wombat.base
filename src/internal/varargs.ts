// Helper for matrix `fromRows` / `fromCols` factories: accept either
// an array of vectors or varargs of vectors, normalise to one form.

export function unpackVecs<T>(args: T[] | [ReadonlyArray<T>]): ReadonlyArray<T> {
  // The varargs overload always passes individual vectors; the
  // array overload passes a single array. We can disambiguate
  // because vectors aren't arrays in the JS sense.
  if (args.length === 1 && Array.isArray(args[0])) {
    return args[0] as ReadonlyArray<T>;
  }
  return args as T[];
}
