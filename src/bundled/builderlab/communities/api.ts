// Block-hosted community accounts through a Builderlab account backend.
import { t, type TranslationKey } from "../../../shared/i18n";

export const HOST_SUFFIX = "communities.buzz.xyz";
export const VALID_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const ACKNOWLEDGEMENT_VERSION = 1;
export const DELETION_PENDING_KEY = "buzz.hosted-community-deletion.v1";

const MAX_RESPONSE_BYTES = 64 * 1024;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type Account = {
  email?: string;
  name?: string;
  expiresAt: string;
  capabilities?: { can_delete_buzz_communities?: boolean };
};
export type ApiError = {
  code?: string;
  message?: string;
  setup_needed?: boolean;
};
export type Identity = { npub?: string; pubkey_hex?: string };
export type Community = {
  id?: string;
  name?: string;
  slug?: string;
  normalized_host?: string;
  archived_at?: string | null;
  owner_pubkey?: string;
  created_at?: string;
};
export type DeletionRequest = {
  community_id: string;
  host: string;
  request_id: string;
  acknowledgement_version: 1;
};
export type DeletionAttempt = "fresh" | "recovery";
export type PendingDeletion = {
  version: 1;
  owner_pubkey: string;
  backend_origin: string;
  request: DeletionRequest;
};
export type Quota = { used: number; limit: number; canCreate: boolean };
export type Reply = {
  error?: ApiError;
  correlation_id?: string;
  identity?: Identity;
  communities?: Community[];
  community?: Community;
  available?: boolean;
  quota_used?: number;
  quota_limit?: number;
  can_create?: boolean;
  request_id?: string;
  community_id?: string;
  host?: string;
  acknowledgement_version?: number;
  status?: string;
};
type Body = Record<string, string | number>;

const messageKeys = {
  missing_mapping: "fubuilderlab.api.missingMapping",
  invalid_name: "fubuilderlab.api.invalidName",
  taken: "fubuilderlab.api.taken",
  limit_reached: "fubuilderlab.api.limitReached",
  unauthorized: "fubuilderlab.api.unauthorized",
  relay_unavailable: "fubuilderlab.api.relayUnavailable",
  identity_already_bound: "fubuilderlab.api.identityAlreadyBound",
  pubkey_already_bound: "fubuilderlab.api.pubkeyAlreadyBound",
  not_owner: "fubuilderlab.api.notOwner",
  transferee_not_registered: "fubuilderlab.api.transfereeNotRegistered",
  invalid_request: "fubuilderlab.api.invalidRequest",
  confirmation_mismatch: "fubuilderlab.api.confirmationMismatch",
  must_archive: "fubuilderlab.api.mustArchive",
  protected_target: "fubuilderlab.api.protectedTarget",
  deletion_conflict: "fubuilderlab.api.deletionConflict",
  unsupported_acknowledgement_version:
    "fubuilderlab.api.unsupportedAcknowledgementVersion",
  acceptance_unknown: "fubuilderlab.api.acceptanceUnknown",
  unknown: "fubuilderlab.api.unknown",
} as const satisfies Record<string, TranslationKey>;

/** The friendly message for a structured error code, in the current language. */
function friendlyMessage(code: string) {
  return Object.hasOwn(messageKeys, code)
    ? t(messageKeys[code as keyof typeof messageKeys])
    : undefined;
}

export class ApiFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly correlationId?: string,
  ) {
    super(
      correlationId ? `${message} Correlation ID: ${correlationId}` : message,
    );
    this.name = "ApiFailure";
  }
}

export function quotaLimitMessage(limit?: number | null) {
  if (limit === 0) return t("fubuilderlab.api.quotaNone");
  return limit && Number.isSafeInteger(limit) && limit > 0
    ? t("fubuilderlab.api.quotaLimit", { limit })
    : t("fubuilderlab.api.limitReached");
}

/** A Builderlab account backend: the development broker or the packaged-app adapter. */
export type Backend = Readonly<{
  /** Identifies this backend in persisted deletion requests. */
  origin: string;
  auth(): Promise<Account | null>;
  send(
    action: string,
    body?: Body,
    signal?: AbortSignal,
  ): Promise<{ status: number; value: object }>;
  /** This device's Buzz key, or null when it cannot be read. */
  localKey(): Promise<string | null>;
}>;

/** The host has no development broker, so Builderlab sign-in cannot work here. */
export class Unsupported extends Error {}

/** The development broker's /api/builderlab routes keep the credential in Node. */
export const broker: Backend = {
  get origin() {
    return window.location.origin;
  },
  async auth() {
    const response = await fetch("/api/builderlab/auth");
    const value = await response.json().catch(() => undefined);
    const auth = value?.auth;
    if (
      response.ok &&
      value &&
      "auth" in value &&
      (auth === null || typeof auth?.expiresAt === "string")
    )
      return auth;
    if (response.ok || response.status === 404)
      throw new Unsupported(
        "Hosted communities need the Buzz development broker and are unavailable in this build.",
      );
    throw new Error(
      value?.error ?? `Builderlab request failed (${response.status})`,
    );
  },
  async send(action, body, signal) {
    const response = await fetch(`/api/builderlab/${action}`, {
      method: action === "auth" ? "GET" : "POST",
      ...(action === "auth"
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body ?? {}),
          }),
      ...(signal ? { signal } : {}),
    });
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES)
      throw new Error("Builderlab response was too large");
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw new Error("Builderlab returned an invalid response");
    }
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("Builderlab returned an invalid response");
    const error = (value as { error?: unknown }).error;
    if (!response.ok && (!error || typeof error !== "object"))
      throw new Error(
        typeof error === "string"
          ? error
          : `Builderlab request failed (${response.status})`,
      );
    return { status: response.status, value };
  },
  async localKey() {
    try {
      const response = await fetch("/api/relay/identity");
      if (!response.ok) throw new Error(String(response.status));
      const { viewer } = (await response.json()) as { viewer?: string };
      return boundKey(viewer ? { pubkey_hex: viewer } : null);
    } catch {
      return null;
    }
  },
};

/** Account operations over one backend. */
export function createApi(backend: Backend) {
  return {
    origin: () => backend.origin,
    getAuth: () => backend.auth(),
    localKey: () => backend.localKey(),
    login: (signal: AbortSignal) =>
      backend
        .send("login", {}, signal)
        .then(({ value }) => (value as { auth: Account }).auth),
    signOut: () => backend.send("sign-out"),
    call: (action: string, body?: Body) =>
      backend.send(action, body).then(({ value }) => value as Reply),
    admitDeletion: (request: DeletionRequest, attempt: DeletionAttempt) =>
      admitDeletion(backend, request, attempt),
  };
}
export type Api = ReturnType<typeof createApi>;
export const brokerApi = createApi(broker);

/** Throws a friendly message for a structured Builderlab error. */
export function check(reply: Reply, fallback: string, quotaLimit?: number) {
  if (!reply.error) return reply;
  const code = reply.error.code ?? "";
  throw new ApiFailure(
    code,
    code === "limit_reached"
      ? quotaLimitMessage(quotaLimit)
      : (friendlyMessage(code) ?? reply.error.message ?? fallback),
    reply.correlation_id,
  );
}

/** The hex key the account is bound to, or null when the server sent no usable key. */
export function boundKey(identity: Identity | null | undefined) {
  const hex = identity?.pubkey_hex?.trim().toLowerCase();
  return hex && /^[0-9a-f]{64}$/.test(hex) ? hex : null;
}
export function relayUrl(community: Community) {
  const host = community.normalized_host?.trim();
  return host ? `wss://${host.replace(/^wss?:\/\//, "")}` : null;
}

/** Missing or malformed authoritative quota is intentionally not reconstructed. */
export function quota(reply: Reply): Quota | null {
  const { quota_used: used, quota_limit: limit, can_create: canCreate } = reply;
  return Number.isInteger(used) &&
    Number.isInteger(limit) &&
    (used as number) >= 0 &&
    (limit as number) >= 0 &&
    (used as number) <= 2_147_483_647 &&
    (limit as number) <= 2_147_483_647 &&
    typeof canCreate === "boolean"
    ? { used: used as number, limit: limit as number, canCreate }
    : null;
}

function exactKeys(value: object, expected: string[]) {
  const keys = Object.keys(value).sort();
  const sorted = [...expected].sort();
  return (
    keys.length === sorted.length &&
    keys.every((key, index) => key === sorted[index])
  );
}

function validDeletionRequest(value: unknown): value is DeletionRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const request = value as Record<string, unknown>;
  return (
    exactKeys(request, [
      "community_id",
      "host",
      "request_id",
      "acknowledgement_version",
    ]) &&
    typeof request.community_id === "string" &&
    request.community_id.length > 0 &&
    request.community_id.length <= 200 &&
    typeof request.host === "string" &&
    request.host.length > 0 &&
    request.host.length <= 253 &&
    request.host === request.host.trim() &&
    typeof request.request_id === "string" &&
    UUID.test(request.request_id) &&
    request.acknowledgement_version === ACKNOWLEDGEMENT_VERSION
  );
}

export function makePendingDeletion(
  ownerPubkey: string,
  community: Community,
  backendOrigin: string,
): PendingDeletion {
  if (
    !/^[0-9a-f]{64}$/.test(ownerPubkey) ||
    !community.id ||
    !community.normalized_host
  )
    throw new Error("The community deletion target is incomplete");
  return {
    version: 1,
    owner_pubkey: ownerPubkey,
    backend_origin: backendOrigin,
    request: {
      community_id: community.id,
      host: community.normalized_host,
      request_id: crypto.randomUUID(),
      acknowledgement_version: ACKNOWLEDGEMENT_VERSION,
    },
  };
}

function validPendingDeletion(value: unknown): value is PendingDeletion {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const pending = value as Record<string, unknown>;
  try {
    return (
      exactKeys(pending, [
        "version",
        "owner_pubkey",
        "backend_origin",
        "request",
      ]) &&
      pending.version === 1 &&
      typeof pending.owner_pubkey === "string" &&
      /^[0-9a-f]{64}$/.test(pending.owner_pubkey) &&
      typeof pending.backend_origin === "string" &&
      pending.backend_origin === new URL(pending.backend_origin).origin &&
      validDeletionRequest(pending.request)
    );
  } catch {
    return false;
  }
}

export function readPendingDeletion(): PendingDeletion | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(DELETION_PENDING_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (validPendingDeletion(value)) return value;
  } catch {
    // Invalid local data is not authority and is discarded below.
  }
  try {
    localStorage.removeItem(DELETION_PENDING_KEY);
  } catch {
    // Invalid local data is never authority; an unavailable store is harmless here.
  }
  return null;
}

export function persistPendingDeletion(pending: PendingDeletion) {
  const serialized = JSON.stringify(pending);
  const current = readPendingDeletion();
  if (current && JSON.stringify(current) !== serialized)
    throw new Error("Another community deletion is already pending");
  localStorage.setItem(DELETION_PENDING_KEY, serialized);
  if (JSON.stringify(readPendingDeletion()) !== serialized)
    throw new Error("The pending deletion could not be verified");
}

export function clearPendingDeletion(expected: PendingDeletion) {
  const current = readPendingDeletion();
  if (current && JSON.stringify(current) === JSON.stringify(expected)) {
    try {
      localStorage.removeItem(DELETION_PENDING_KEY);
    } catch {
      // A retained request can be checked again on reopen.
    }
  }
}

function matchesDeletion(reply: Reply, request: DeletionRequest) {
  return (
    reply.request_id === request.request_id &&
    reply.community_id === request.community_id &&
    reply.host === request.host &&
    reply.acknowledgement_version === request.acknowledgement_version
  );
}

const DEFINITIVE_DELETION_REJECTIONS = new Map([
  ["missing_mapping", 400],
  ["invalid_request", 400],
  ["confirmation_mismatch", 400],
  ["unsupported_acknowledgement_version", 400],
  ["not_owner", 404],
  ["must_archive", 409],
  ["protected_target", 409],
  ["deletion_conflict", 409],
]);
/**
 * Rejections that do not prove the saved UUID lacks a relay reservation: KGoose
 * preflights and the acknowledgement version, which the relay checks before its
 * UUID lookup. The rest are relay verdicts reached only after a known UUID would
 * have returned its stage (or, for protected_target, can never admit the host),
 * so they settle recovery as well.
 */
const FRESH_ONLY_DELETION_REJECTIONS = new Set([
  "missing_mapping",
  "invalid_request",
  "confirmation_mismatch",
  "unsupported_acknowledgement_version",
]);
const DELETION_PROGRESS_STAGES = new Set([
  "submitted",
  "inventoried",
  "approved",
  "fenced",
  "drained",
  "bindings_removed",
  "postgres_purged",
  "cache_purged",
  "logically_verified",
  "retention_pending",
]);

class DefinitiveDeletionRejection extends ApiFailure {}

export function isDefinitiveDeletionRejection(reason: unknown) {
  return reason instanceof DefinitiveDeletionRejection;
}

/** A possible dispatch terminates only on a tuple-bound 202 stage or abort. */
function deletionResult(
  response: { status: number; value: Reply },
  request: DeletionRequest,
) {
  const { status, value } = response;
  if (
    status === 202 &&
    !value.error &&
    DELETION_PROGRESS_STAGES.has(value.status ?? "") &&
    matchesDeletion(value, request)
  )
    return value;
  if (
    status === 202 &&
    !value.error &&
    value.status === "aborted" &&
    matchesDeletion(value, request)
  )
    throw new ApiFailure(
      "deletion_aborted",
      t("fubuilderlab.hc.deletionStopped", { host: request.host }),
      value.correlation_id,
    );
  throw new ApiFailure(
    "acceptance_unknown",
    t("fubuilderlab.api.acceptanceUnknown"),
    value.correlation_id,
  );
}

/** One same-UUID POST per explicit attempt; relay verdicts that prove no reservation also settle recovery. */
async function admitDeletion(
  backend: Backend,
  request: DeletionRequest,
  attempt: DeletionAttempt,
) {
  let response: { status: number; value: Reply };
  try {
    response = (await backend.send("delete", request)) as typeof response;
  } catch {
    throw new ApiFailure(
      "acceptance_unknown",
      t("fubuilderlab.api.acceptanceUnknown"),
    );
  }
  const code = response.value.error?.code ?? "";
  if (
    DEFINITIVE_DELETION_REJECTIONS.get(code) === response.status &&
    (attempt === "fresh" || !FRESH_ONLY_DELETION_REJECTIONS.has(code))
  )
    throw new DefinitiveDeletionRejection(
      code,
      friendlyMessage(code) ??
        response.value.error?.message ??
        t("fubuilderlab.api.startDeletionFailed"),
      response.value.correlation_id,
    );
  return deletionResult(response, request);
}
