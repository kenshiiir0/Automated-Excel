import { fileTypeFromBuffer } from 'file-type';

// The client-declared MIME type (multer's file.mimetype) comes straight
// from the Content-Type of the multipart form part -- the browser sets it
// from the file's extension, and nothing stops a request crafted outside
// a browser (curl, a script) from setting it to anything at all. Renaming
// payload.exe to invoice.pdf and declaring Content-Type: application/pdf
// sails straight through a MIME-only allowlist. This sniffs the file's
// actual leading bytes (its real signature) and cross-checks that
// against what was declared, so a mismatch is caught before the buffer
// ever reaches sendFileEmail() and goes out as an email attachment.
//
// Office formats (.docx/.xlsx/.pptx) are zip containers under the hood,
// so file-type reports them as 'application/zip' at the signature level
// -- it deliberately does not parse the internal [Content_Types].xml to
// tell them apart (that kind of deep-parsing is exactly the sort of thing
// a zip-bomb/decompression-DoS CVE targets, per GHSA-j47w-4g3g-c36v,
// which is why this project pins file-type@22.0.2, the first version
// with that fixed). So the "real" match for any zip-based declared type
// is any file-type result that also comes back as zip.
const ZIP_BASED_DECLARED_TYPES = new Set([
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'application/zip',
    'application/x-zip-compressed',
]);

// Legacy Office formats (.doc/.xls/.ppt, pre-2007) are OLE2 Compound File
// Binary Format documents, not zip -- file-type correctly sniffs these
// as 'application/x-cfb'. Treat that signature as an accepted match for
// a declared legacy-Office MIME type.
const OLE2_DECLARED_TYPES = new Set([
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
]);
const OLE2_SNIFFED_MIMES = new Set(['application/x-cfb']);

const DIRECT_MATCH_TYPES = new Set([
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif',
]);

// text/plain and text/csv have no reliable magic-byte signature at all --
// file-type correctly returns undefined for genuinely unstructured text.
// Accepting "no detected signature" for these declared types is the
// correct behavior here, not a bypass: a real executable, PDF, image, or
// Office document all DO have a detectable signature, so if one of those
// were relabeled as text/csv, file-type would still detect its true
// binary signature and this function's default branch below rejects that
// mismatch.
const NO_SIGNATURE_EXPECTED_TYPES = new Set(['text/plain', 'text/csv']);

export async function verifyActualFileType(buffer, declaredMimeType) {
    const detected = await fileTypeFromBuffer(buffer);

    if (!detected) {
        if (NO_SIGNATURE_EXPECTED_TYPES.has(declaredMimeType)) {
            return { ok: true, sniffed: null };
        }
        // No recognizable signature, but the declared type is something
        // that SHOULD have one (pdf, image, office doc, zip). Likely an
        // empty/corrupt/truncated file rather than a spoofing attempt,
        // but either way it isn't genuinely the declared type.
        return { ok: false, sniffed: null };
    }

    if (DIRECT_MATCH_TYPES.has(declaredMimeType)) {
        return { ok: detected.mime === declaredMimeType, sniffed: detected.mime };
    }
    if (OLE2_DECLARED_TYPES.has(declaredMimeType)) {
        return { ok: OLE2_SNIFFED_MIMES.has(detected.mime), sniffed: detected.mime };
    }
    if (ZIP_BASED_DECLARED_TYPES.has(declaredMimeType)) {
        return { ok: detected.mime === 'application/zip', sniffed: detected.mime };
    }
    if (NO_SIGNATURE_EXPECTED_TYPES.has(declaredMimeType)) {
        // A binary signature was found (e.g. detected.mime === 'application/x-msdownload')
        // for a file declared as plain text/CSV -- that mismatch is exactly
        // the spoofing case this check exists to catch.
        return { ok: false, sniffed: detected.mime };
    }
    // Declared type isn't one this function knows how to cross-check --
    // fail closed rather than silently accepting an unrecognized case.
    return { ok: false, sniffed: detected.mime };
}
