export interface Segment {
  start: number; // inclusive
  end: number;   // exclusive
}

export function initialSegment(atomCount: number): Segment[] {
  return [{ start: 0, end: atomCount }];
}

/**
 * Split the segment containing index into two segments at that index.
 * The atom at `index` becomes the first atom of the second segment.
 */
export function cutAt(segments: Segment[], index: number): Segment[] {
  const result: Segment[] = [];
  for (const s of segments) {
    if (index <= s.start || index >= s.end) {
      result.push(s);
    } else {
      result.push({ start: s.start, end: index });
      result.push({ start: index, end: s.end });
    }
  }
  return result;
}

/** Merge two segments into one. Used by the attach tool. */
export function mergeSegments(
  segments: Segment[],
  indexA: number,
  indexB: number
): Segment[] {
  const findSeg = (i: number) =>
    segments.findIndex((s) => i >= s.start && i < s.end);
  const a = findSeg(indexA);
  const b = findSeg(indexB);
  if (a < 0 || b < 0 || a === b) return segments;
  const sa = segments[a];
  const sb = segments[b];
  const merged: Segment = {
    start: Math.min(sa.start, sb.start),
    end: Math.max(sa.end, sb.end),
  };
  const rest = segments.filter((_, i) => i !== a && i !== b);
  return [...rest, merged].sort((x, y) => x.start - y.start);
}
