const express = require('express');
const router = express.Router();
router.get('/loop', (req, res) => { while(true){} });
router.get('/deprecated', (req, res) => { process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; res.send('ok'); });
module.exports = router; 