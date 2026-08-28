import express from 'express';
import multer from 'multer';
import { sendFile, listFileShares, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '../controllers/fileShareController.js';
import { requireWriteAccess } from '../lib/requireRole.js';

const router = express.Router();

// Memory storage only -- the file lives in a Buffer for the lifetime of
// this one request (attached straight to the outgoing email in
// fileShareController.js) and is never written to disk or to Supabase
// Storage. fileFilter rejects anything outside the common
// document/image/zip allowlist before the upload even finishes, and
// limits.fileSize enforces the 20MB cap at the multer layer so an
// oversized upload is stopped early rather than after a slow transfer.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE_BYTES },
    fileFilter: (req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
            return cb(new Error(`"${file.originalname}" isn't an accepted file type for Send Files.`));
        }
        cb(null, true);
    },
});

// Turns multer's own errors (file too large, rejected type) into the
// same clean JSON error shape every other endpoint in this app uses,
// instead of letting multer's default Express error handler produce an
// HTML stack trace or a bare "Internal Server Error".
function handleUpload(req, res, next) {
    upload.single('file')(req, res, (err) => {
        if (!err) return next();
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: 'That file is larger than the 20MB limit for Send Files.' });
        }
        return res.status(400).json({ error: err.message || 'Could not process the uploaded file.' });
    });
}

// Admin/super_admin only, same gate as disciplinary memos -- sending an
// arbitrary file straight to an employee's inbox is a write/HR action,
// not something a plain 'user' role account should be able to trigger.
router.get('/file-share', requireWriteAccess, listFileShares);
router.post('/file-share/send', requireWriteAccess, handleUpload, sendFile);

export default router;
