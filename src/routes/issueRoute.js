const express = require('express');
const router = express.Router();
router.get('/danger', (req, res) => { eval('alert(1)'); });
router.get('/sync', (req, res) => { require('fs').readFileSync('x'); });
router.get('/unused', (req, res) => { let x; res.send('ok'); });
module.exports = router; 