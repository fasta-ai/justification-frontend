import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// const BACKEND_IP = "35.240.222.126"; // new google server
const BACKEND_IP = "localhost:3000";
// const BACKEND_IP = "192.168.31.234"; // local dev

export const NEXT_PUBLIC_API_URL = `http://${BACKEND_IP}`;
export const PYTHON_BACKEND_URL = `http://${BACKEND_IP}:8000`;
// export const CLOUDFRONT_URL =
//   "https://jpeg-phd-innovations-austin.trycloudflare.com";

export const CLOUDFRONT_URL =
  "https://costume-equally-tired-connected.trycloudflare.com";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
