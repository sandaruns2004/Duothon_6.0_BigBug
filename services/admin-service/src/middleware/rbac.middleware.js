const requireRole = (...allowedRoles) => (req, res, next) => {
  const role = req.headers['x-user-role'];
  if (!role || !allowedRoles.includes(role.toUpperCase())) {
    return res.status(403).json({ success: false, error: 'Insufficient permissions.' });
  }
  next();
};

module.exports = { requireRole };
