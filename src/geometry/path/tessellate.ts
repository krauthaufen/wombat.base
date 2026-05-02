// End-to-end convenience helper: take a list of closed paths or
// raw segments, run the full Stage 2–3.5 pipeline, and return the
// connected planar graph, face extraction, per-face winding, and
// filled-face index set under an arbitrary fill rule.
//
// For callers who want the intermediate artefacts (planar graph,
// face cycles, etc.) the underlying functions remain individually
// exported. This helper just wires them together for the common case.

import type { Path } from "./path.js";
import type { PathSegment } from "./segment.js";
import { buildPlanarGraph, type PlanarGraph } from "./planar-graph.js";
import {
  extractFaces, type FaceExtractionResult,
} from "./face-extract.js";
import { detectComponents } from "./components.js";
import { connectComponents } from "./bridge.js";
import { computeWindings } from "./winding.js";
import { type FillRule, FillRules } from "./fill-rule.js";
import { DEFAULT_EPS } from "./intersect.js";

export interface TessellationResult {
  /** Augmented planar graph with bridge edges connecting components. */
  readonly graph: PlanarGraph;
  /** Face extraction over the augmented graph. */
  readonly extraction: FaceExtractionResult;
  /** Winding number for every face in `extraction.faces`. */
  readonly windings: ReadonlyArray<number>;
  /** Indices of faces selected by the supplied fill rule. */
  readonly filledFaces: ReadonlyArray<number>;
}

/**
 * Run the full Stage 2 → Stage 3.5 pipeline on a list of closed
 * paths (or raw segments) and apply `fillRule` to determine which
 * faces are filled. Returns the augmented graph, face extraction,
 * windings, and filled-face indices.
 *
 * `fillRule` defaults to non-zero. Pass `FillRules.evenOdd`,
 * `FillRules.positive`, etc., or any user-defined predicate.
 */
export function tessellatePath(
  input: ReadonlyArray<Path | PathSegment>,
  fillRule: FillRule = FillRules.nonZero,
  eps: number = DEFAULT_EPS,
): TessellationResult {
  // Flatten Paths into segments while preserving the user's order.
  const segments: PathSegment[] = [];
  for (const item of input) {
    if (
      typeof item === "object" && item !== null
      && "segments" in item && Array.isArray((item as Path).segments)
    ) {
      for (const s of (item as Path).segments) segments.push(s);
    } else {
      segments.push(item as PathSegment);
    }
  }

  const graph0 = buildPlanarGraph(segments, eps);
  const ext0 = extractFaces(graph0);
  const dec = detectComponents(ext0, graph0);
  const graph = dec.components.length > 1
    ? connectComponents(graph0, dec, eps)
    : graph0;
  const extraction = dec.components.length > 1 ? extractFaces(graph) : ext0;
  const windings = computeWindings(extraction, graph);
  const filledFaces: number[] = [];
  for (let i = 0; i < windings.length; i++) {
    if (fillRule(windings[i]!)) filledFaces.push(i);
  }
  return { graph, extraction, windings, filledFaces };
}
