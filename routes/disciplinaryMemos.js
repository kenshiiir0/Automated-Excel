import express from 'express';
import { listMemoTypes, previewMemo, sendMemo, listMemos, draftNarrative } from '../controllers/disciplinaryMemosController.js';
import { requireWriteAccess } from '../lib/requireRole.js';

const router = express.Router();

// All routes here require admin+ (requireWriteAccess) -- generating and
// sending disciplinary memos is squarely a write/HR-action capability,
// not something a plain 'user' role account should be able to trigger,
// unlike the read-only HR Documents routes.
router.get('/disciplinary-memos/types', requireWriteAccess, listMemoTypes);
router.get('/disciplinary-memos', requireWriteAccess, listMemos);
router.post('/disciplinary-memos/draft-narrative', requireWriteAccess, draftNarrative);
router.post('/disciplinary-memos/preview', requireWriteAccess, previewMemo);
router.post('/disciplinary-memos/send', requireWriteAccess, sendMemo);

export default router;
