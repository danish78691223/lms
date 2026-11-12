import { Activity } from "../models/index.js";
export async function audit(actor, action, target, details = "") {
  try { await Activity.create({ actor, action, target, details }); } catch (e) { console.error("audit:", e.message); }
}
