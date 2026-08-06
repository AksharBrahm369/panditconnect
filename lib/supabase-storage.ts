const PROJECT_URL = process.env.SUPABASE_URL ?? "https://bkmctsydceofqyhkxepk.supabase.co";
export const PANDIT_DOCUMENT_BUCKET = process.env.FILE_STORAGE_BUCKET || "pandit-private-documents";

function serviceKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return key;
}

function headers(contentType?: string) {
  const key = serviceKey();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...(contentType ? { "Content-Type": contentType } : {}),
  };
}

export async function uploadPrivateObject(path: string, file: File) {
  const response = await fetch(`${PROJECT_URL}/storage/v1/object/${PANDIT_DOCUMENT_BUCKET}/${path}`, {
    method: "POST",
    headers: { ...headers(file.type), "x-upsert": "false" },
    body: await file.arrayBuffer(),
  });
  if (!response.ok) throw new Error(`Private upload failed (${response.status})`);
}

export async function deletePrivateObject(path: string) {
  const response = await fetch(`${PROJECT_URL}/storage/v1/object/${PANDIT_DOCUMENT_BUCKET}`, {
    method: "DELETE",
    headers: headers("application/json"),
    body: JSON.stringify({ prefixes: [path] }),
  });
  if (!response.ok) throw new Error(`Private object cleanup failed (${response.status})`);
}

export async function createPrivateSignedUrl(path: string, expiresIn = 300) {
  const response = await fetch(`${PROJECT_URL}/storage/v1/object/sign/${PANDIT_DOCUMENT_BUCKET}/${path}`, {
    method: "POST",
    headers: headers("application/json"),
    body: JSON.stringify({ expiresIn }),
  });
  if (!response.ok) throw new Error(`Signed link creation failed (${response.status})`);
  const data = await response.json() as { signedURL?: string; signedUrl?: string };
  const signedPath = data.signedURL ?? data.signedUrl;
  if (!signedPath) throw new Error("Signed link was not returned");
  return signedPath.startsWith("http") ? signedPath : `${PROJECT_URL}/storage/v1${signedPath}`;
}
