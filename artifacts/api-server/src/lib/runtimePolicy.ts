export type RuntimeRole = "primary" | "promoted" | "standby" | "dr" | string;

export const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function mutationsAllowedForRole(role: RuntimeRole): boolean {
  return role === "primary" || role === "promoted";
}

export function shouldRejectMutation(role: RuntimeRole, method: string): boolean {
  return MUTATION_METHODS.has(method.toUpperCase()) && !mutationsAllowedForRole(role);
}

/**
 * In-process jobs with side effects (Telegram summaries, stock alerts, keep-alive,
 * backup mirror) may run on the canonical writer only. A standby/DR instance must
 * stay quiet even if SCHEDULER_ENABLED was copied from the primary by mistake.
 */
export function schedulerShouldRun(
  role: RuntimeRole,
  schedulerEnabled: string | undefined = process.env.SCHEDULER_ENABLED,
): boolean {
  if (schedulerEnabled === "false") return false;
  return mutationsAllowedForRole(role);
}

/**
 * The legacy 30-minute full Neon TRUNCATE mirror must never run unless the
 * operator explicitly enables it on the current writer. Standby/DR must not
 * mirror even if the flag is wrongly set.
 */
export function backupSyncShouldRun(
  role: RuntimeRole,
  backupEnabled: string | undefined = process.env.BACKUP_SYNC_ENABLED,
): boolean {
  return backupEnabled === "true" && mutationsAllowedForRole(role);
}
