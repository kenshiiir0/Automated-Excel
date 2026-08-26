const express = require('express');
const { getEmailDirectory, addToDirectory, sendEmail } = require('../controllers/emailController.js');

const router = express.Router();

router.get('/directory', getEmailDirectory);
router.post('/directory', addToDirectory);
router.post('/send', sendEmail);

module.exports = router;