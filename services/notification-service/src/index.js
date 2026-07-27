const express = require('express');
const app = express();
const PORT = process.env.PORT || 3004;

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'notification-service' });
});

app.listen(PORT, () => {
  console.log(`✅ Notification Service running on port ${PORT}`);
});
