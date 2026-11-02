import "server-only";
import { createHomeContactHandler } from "../../../../shared/home-contact-handler.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = createHomeContactHandler();
