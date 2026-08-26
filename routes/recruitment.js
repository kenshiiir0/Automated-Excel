const express = require('express');
const { getAllCandidates, createCandidate, updateCandidate, deleteCandidate } = require('../controllers/recruitmentController.js');

const router = express.Router();

router.get('/candidates', getAllCandidates);
router.post('/candidates', createCandidate);
router.put('/candidates/:id', updateCandidate);
router.delete('/candidates/:id', deleteCandidate);

module.exports = router;