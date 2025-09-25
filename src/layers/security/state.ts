const SUBMISSION_PREFIX = "submission:";
const DEFAULT_TTL_SECONDS = 60 * 60 * 24; // 24 hours

export interface SubmissionStateRecord {
  status: "processed" | "pending";
  updatedAt: number;
}

export async function isSubmissionProcessed(
  kv: KVNamespace,
  submissionId: string
): Promise<boolean> {
  const record = await getSubmissionRecord(kv, submissionId);
  return record?.status === "processed";
}

export async function markSubmissionPending(
  kv: KVNamespace,
  submissionId: string,
  ttlSeconds = DEFAULT_TTL_SECONDS
): Promise<void> {
  const record: SubmissionStateRecord = {
    status: "pending",
    updatedAt: Date.now(),
  };
  await kv.put(getKey(submissionId), JSON.stringify(record), {
    expirationTtl: ttlSeconds,
  });
}

export async function markSubmissionProcessed(
  kv: KVNamespace,
  submissionId: string,
  ttlSeconds = DEFAULT_TTL_SECONDS
): Promise<void> {
  const record: SubmissionStateRecord = {
    status: "processed",
    updatedAt: Date.now(),
  };
  await kv.put(getKey(submissionId), JSON.stringify(record), {
    expirationTtl: ttlSeconds,
  });
}

async function getSubmissionRecord(
  kv: KVNamespace,
  submissionId: string
): Promise<SubmissionStateRecord | null> {
  const raw = await kv.get(getKey(submissionId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as SubmissionStateRecord;
    if (parsed.status === "processed" || parsed.status === "pending") {
      return parsed;
    }
  } catch (error) {
    console.warn("securityState: failed to parse submission record", {
      submissionId,
      error,
    });
  }

  return null;
}

function getKey(submissionId: string): string {
  return `${SUBMISSION_PREFIX}${submissionId}`;
}
