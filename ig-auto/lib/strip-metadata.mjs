// Remove every metadata block from a photo, losslessly.
//
// WHY
// The Drive PUBLISH folder is synced into this repo, and this repo is public.
// One photo carried GPS coordinates, a person's name and a capture date; five
// carried the phone model; twenty two carried AI provenance markers. None of
// that should be published, and none of it is needed to post a picture.
//
// LOSSLESS ON PURPOSE
// This cuts metadata segments out of the container and leaves the compressed
// image data untouched. Re-encoding through an image library would be one
// line shorter and would cost a generation of JPEG quality on every sync.
//
// THE COLOUR PROFILE STAYS
// An ICC profile is metadata but it is not information about anyone: it tells
// a decoder how to read the colours. Strip a Display P3 profile and sharp
// will read the pixels as sRGB, which visibly washes the picture out. So APP2
// is kept when it is a real ICC profile, and removed when it is a C2PA
// provenance block, which also lives in APP2.
//
// No dependencies, matching the rest of this folder: nothing on the posting
// path should be able to break because of an npm package.

const JPEG_KEEP_APP0 = true;   // JFIF is a container marker, carries no data

/** JPEG: drop APP1..APP15 and COM, keep JFIF and a genuine ICC profile. */
function stripJpeg(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  const out = [buf.subarray(0, 2)];
  let i = 2;
  while (i < buf.length - 1) {
    if (buf[i] !== 0xff) break;
    const marker = buf[i + 1];
    // Start of scan: everything from here is compressed image data.
    if (marker === 0xda) { out.push(buf.subarray(i)); i = buf.length; break; }
    if (marker === 0xd9) { out.push(buf.subarray(i)); i = buf.length; break; }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(buf.subarray(i, i + 2)); i += 2; continue;
    }
    const len = buf.readUInt16BE(i + 2);
    const seg = buf.subarray(i, i + 2 + len);
    const body = buf.subarray(i + 4, i + 2 + len);

    let drop = false;
    if (marker === 0xe0) drop = !JPEG_KEEP_APP0;              // JFIF
    else if (marker === 0xe2) {
      // APP2 is shared: ICC_PROFILE is colour, JUMB/c2pa is provenance.
      const tag = body.subarray(0, 12).toString("latin1");
      drop = !tag.startsWith("ICC_PROFILE");
    } else if (marker >= 0xe1 && marker <= 0xef) drop = true;  // APP1..APP15
    else if (marker === 0xfe) drop = true;                     // COM

    if (!drop) out.push(seg);
    i += 2 + len;
  }
  return Buffer.concat(out);
}

/** PNG: drop text and EXIF chunks, keep iCCP for the same colour reason. */
function stripPng(buf) {
  const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buf.subarray(0, 8).equals(SIG)) return null;
  // caBX is the JUMBF box that carries a C2PA manifest in a PNG. It was missed
  // on the first pass and left the provenance intact in 21 files while every
  // other marker was gone, which is exactly the kind of half clean that reads
  // as done. Found by locating the surviving match and asking which chunk it
  // sat in, rather than trusting the sweep.
  const DROP = new Set(["tEXt", "iTXt", "zTXt", "eXIf", "tIME", "dSIG", "caBX"]);
  const out = [buf.subarray(0, 8)];
  let i = 8;
  while (i < buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.subarray(i + 4, i + 8).toString("latin1");
    const total = 12 + len;
    if (!DROP.has(type)) out.push(buf.subarray(i, i + total));
    i += total;
    if (type === "IEND") break;
  }
  return Buffer.concat(out);
}

/** Returns a cleaned buffer, or the original when the format is unknown. */
export function stripMetadata(buf) {
  try {
    return stripJpeg(buf) || stripPng(buf) || buf;
  } catch {
    // A malformed file must never stop a sync. Better the original photo with
    // its metadata than no photo at all, and check-metadata.mjs will flag it.
    return buf;
  }
}
