/**
 * Build the `current_case` payload for /api/suggest/justification.
 *
 * The BFF rejects a missing `current_case` with
 * "AI generation failed (400): Missing required field: current_case".
 * Manual-entry cases often have no catalogue `products[]` (Argus, case 2901P),
 * and some extractors nest products under `data.products`. Either way the
 * generate call used to send `undefined`. The Python prompt already treats
 * `products[]` as optional and falls back to application data, EG fields and
 * the catalogue description — so we always send a truthy product profile.
 */
export type CurrentCaseProduct = Record<string, unknown>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asProductList(value: unknown): CurrentCaseProduct[] {
  if (Array.isArray(value)) {
    return value.filter(isPlainObject).map((p) => ({ ...p }));
  }
  if (
    isPlainObject(value) &&
    (value.product_name || value.model || value.description || value.brand)
  ) {
    return [{ ...value }];
  }
  return [];
}

/** Catalogue products from the shapes the extractors and Stage 1/3 actually store. */
export function extractCatalogueProducts(
  catalogueData: unknown,
): CurrentCaseProduct[] {
  if (!catalogueData) return [];
  if (Array.isArray(catalogueData)) return asProductList(catalogueData);
  if (!isPlainObject(catalogueData)) return [];

  const cat = catalogueData;
  const data = cat.data;
  const nested = isPlainObject(cat.catalogue_data) ? cat.catalogue_data : null;

  const candidates: unknown[] = [
    cat.products,
    isPlainObject(data) ? data.products : undefined,
    Array.isArray(data) ? data : undefined,
    nested?.products,
  ];

  for (const candidate of candidates) {
    const products = asProductList(candidate);
    if (products.length > 0) return products;
  }
  return [];
}

export interface CurrentCaseExtras {
  productName?: string;
  model?: string;
  brand?: string;
  description?: string;
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    if (value == null) continue;
    const s = String(value).trim();
    if (s) return s;
  }
  return "";
}

/**
 * Always returns a non-empty array so the BFF's `if (!current_case)` check
 * passes. Prefers stored catalogue products; otherwise synthesises a profile
 * from the EG / application fields the reviewer already has on screen.
 */
export function buildCurrentCaseForPrompt(
  catalogueData: unknown,
  extras: CurrentCaseExtras = {},
): CurrentCaseProduct[] {
  const products = extractCatalogueProducts(catalogueData);
  const name = firstNonEmpty(extras.productName);
  const model = firstNonEmpty(extras.model);
  const brand = firstNonEmpty(extras.brand);
  const description = firstNonEmpty(extras.description);

  if (products.length === 0) {
    const synthesized: CurrentCaseProduct = {};
    if (name) synthesized.product_name = name;
    if (model) synthesized.model = model;
    if (brand) synthesized.brand = brand;
    if (description) synthesized.description = description;
    return [synthesized];
  }

  const first = products[0];
  if (name && !firstNonEmpty(first.product_name)) first.product_name = name;
  if (model && !firstNonEmpty(first.model)) first.model = model;
  if (brand && !firstNonEmpty(first.brand)) first.brand = brand;
  if (description && !firstNonEmpty(first.description)) {
    first.description = description;
  }
  return products;
}

/** Same falsy rule the BFF used: undefined / null / "" fail, [] and {} pass. */
export function isCurrentCasePresent(value: unknown): boolean {
  return !(value == null || value === "");
}

/**
 * If the client omitted `current_case`, build one from the rest of the
 * suggest-justification body so a manual-entry case still reaches the model.
 */
export function resolveCurrentCaseForSuggest(body: {
  current_case?: unknown;
  application_data?: Record<string, unknown> | null;
  case_context?: Record<string, unknown> | null;
}): unknown {
  if (isCurrentCasePresent(body.current_case)) return body.current_case;
  const app = body.application_data || {};
  const ctx = body.case_context || {};
  return buildCurrentCaseForPrompt(undefined, {
    productName: firstNonEmpty(ctx.egProductName, app.PA_PName),
    model: firstNonEmpty(ctx.egModelNo, app.PA_Mod_No),
    brand: firstNonEmpty(ctx.egBrand, app.PA_Brand),
    description: firstNonEmpty(ctx.catalogueDescription),
  });
}
