import clientsJson from "@/data/clients.json";
import profilesJson from "@/data/profiles.json";
import sharesJson from "@/data/shares.json";
import type { Client, Profile, Share } from "./types";

export const clients = clientsJson as Client[];
export const profiles = profilesJson as Profile[];
export const shares = sharesJson as Share[];

export const clientById = new Map(clients.map((c) => [c.id, c]));
export const profileById = new Map(profiles.map((p) => [p.id, p]));
