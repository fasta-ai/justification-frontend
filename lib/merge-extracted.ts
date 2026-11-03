/**
 * Apply a field-level patch (an accepted AI suggestion, an auto-applied
 * tidy-up, a revert) to a section extracted in Stage 1.
 *
 * Stage 1 keeps two copies of each extracted section: the product's stored
 * `{ data }` (what Stage 2 saves onto the case) and the preview's editable
 * copy. The editable copy is only filled when the preview is opened, so a
 * patch landing before that — the background application AI review usually
 * does — used to be merged onto `{}` and then written back as the whole
 * section, replacing the extraction with just the patched fields. Those cases
 * reached the database with an applicationData of one or two keys, and their
 * A_PA_Form rows exported as identity columns only.
 *
 * The stored extraction is therefore always the base; the editable copy (the
 * reviewer's edits) goes over it, then the patch.
 */
export function mergeOntoExtracted(
  editable: Record<string, unknown> | null | undefined,
  stored: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return { ...(stored ?? {}), ...(editable ?? {}), ...patch };
}
