const express = require('express');
const router = express.Router();
// Dangerous use of eval removed
router.get('/danger', (req, res) => { res.send('ok'); });
router.get('/sync', (req, res) => { require('fs').readFile('x', (err, data) => { res.send(data); }); });
router.get('/unused', (req, res) => { let x; res.send('ok'); });
module.exports = router;