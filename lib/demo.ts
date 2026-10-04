import { clientById } from "./data";
import { shortlistFor } from "./shortlist";
import type { Client, Profile } from "./types";

// A small, hand-picked set so a first-time viewer is not overwhelmed. None of them has a location
// preference, so the "learned preference" demo (rejecting for location twice) works cleanly.
export const DEMO_CLIENT_IDS = ["C01", "C04", "C05", "C10"];
export const demoClients = DEMO_CLIENT_IDS.map((id) => clientById.get(id)!);

// Profiles that were already sent to the client before the demo started and are waiting for a reply.
// Only profiles that were actually sent can be rejected, and a blocked profile would not have been sent.
export function seedSent(client: Client): Profile[] {
  return shortlistFor(client, [])
    .filter((c) => c.result.status !== "block")
    .slice(0, 3)
    .map((c) => c.profile);
}
