import roCodes from "@/data/ro-codes.json";
import { FeedbackFlow } from "./FeedbackFlow";

/**
 * Statically generates one page per real RO from the same source data used
 * to print the 127 QR codes (Phase 8 seed data) -- every printed QR code has
 * a matching page in this build, nothing generated speculatively.
 */
export function generateStaticParams() {
  return roCodes.map((ro) => ({ code: ro.qr_code }));
}

export const dynamicParams = false;

export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <FeedbackFlow roCode={code} />;
}
