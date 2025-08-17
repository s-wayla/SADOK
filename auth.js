// middleware/auth.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'eDFvf4-jjkfrni52_qfUnM37J5_EiESK8O1k7_hy@tE5#3';

// دالة التحقق من رمز JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token == null) {
        return res.status(401).json({ error: 'Authentication token required.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Token expired. Please log in again.' });
            }
            return res.status(403).json({ error: 'Invalid token.' });
        }
        req.user = user;
        next();
    });
}

// دالة التحقق من الأدوار (roles)
function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(401).json({ message: 'Access denied. No role provided in token.' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ 
                message: `Forbidden. You do not have the required role to access this resource. Allowed roles: ${allowedRoles.join(', ')}.` 
            });
        }
        next();
    };
}

module.exports = { authenticateToken, authorizeRoles };