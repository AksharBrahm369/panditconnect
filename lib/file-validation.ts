const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

export async function validateUploadedFile(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const valid =
    (file.type === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
    (file.type === "image/png" && bytes.slice(0, 8).every((value, index) => value === [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a][index])) ||
    (file.type === "image/webp" && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") ||
    (file.type === "application/pdf" && ascii(bytes, 0, 5) === "%PDF-") ||
    (file.type === "video/webm" && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) ||
    (["video/mp4", "video/quicktime"].includes(file.type) && ascii(bytes, 4, 4) === "ftyp");
  return valid ? extensions[file.type] : null;
}
