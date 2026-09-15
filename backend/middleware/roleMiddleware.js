const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Access denied. Role '${req.user ? req.user.role : 'Guest'}' is not authorized to access this resource.` 
      });
    }
    next();
  };
};

module.exports = { authorizeRoles };