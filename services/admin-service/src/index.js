const express = require('express');
const app = express();
const PORT = process.env.PORT || 3005;

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'admin-service' });
});

app.listen(PORT, () => {
  console.log(`✅ Admin Service running on port ${PORT}`);
});
