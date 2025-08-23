const express = require('express');
const router = express.Router();
// REMOVED: Infinite loop that blocks the event loop
router.get('/loop', (req, res) => { res.send('Loop endpoint'); });
router.get('/deprecated', (req, res) => { process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; res.send('ok'); });
module.exports = router;