const express = require('express');
const router = express.Router();
const path = require('path');
const dataDir = path.join(__dirname, '..', 'data');
const feeds = require(path.join(dataDir, 'feeds.json'));

router.get('/feeds', (req, res) => {
  res.json({ feeds });
});

module.exports = router;
