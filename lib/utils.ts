import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Backend host.
 *
 * Production is the default so a build with no environment set is always
 * correct. Point somewhere else with an env var rather than by editing this
 * line — a local IP left here shipped to production once (revision 00006) and
 * broke every API call, which is exactly what the default protects against.
 *
 *   NEXT_PUBLIC_BACKEND_HOST=localhost:3000 pnpm dev
 */
const PRODUCTION_BACKEND_HOST = "35.240.222.126"; // new google server
const BACKEND_HOST =
  process.env.NEXT_PUBLIC_BACKEND_HOST || PRODUCTION_BACKEND_HOST;

export const NEXT_PUBLIC_API_URL = `http://${BACKEND_HOST}`;

/**
 * Python extraction service. Runs on :8000 beside the backend, so it follows
 * the same host unless overridden on its own — locally the two often differ.
 */
export const PYTHON_BACKEND_URL =
  process.env.NEXT_PUBLIC_PYTHON_URL ||
  `http://${BACKEND_HOST.split(":")[0]}:8000`;

/** Tunnel the catalogue extractor is reached through from the browser. */
export const CLOUDFRONT_URL =
  process.env.NEXT_PUBLIC_CLOUDFRONT_URL ||
  "https://costume-equally-tired-connected.trycloudflare.com";

/** True when this build is pointed at production. Shown in the import UI. */
export const IS_PRODUCTION_BACKEND =
  BACKEND_HOST === PRODUCTION_BACKEND_HOST;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
