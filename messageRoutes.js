const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

/**
 * POST /messages
 * إرسال رسالة إلى مستخدم آخر (محمي)
 */
router.post('/messages', authenticateToken, [
    body('receiverId').isInt({ gt: 0 }).withMessage('Receiver ID is required and must be a positive integer.'),
    body('message').trim().notEmpty().withMessage('Message content is required.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { receiverId, message } = req.body;
    const senderId = req.user.id;
    try {
        const msg = await db.sendMessage(senderId, receiverId, message);
        res.status(201).json(msg);
    } catch (err) {
        console.error('Error sending message:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * GET /messages
 * جلب جميع الرسائل للمستخدم (مرتبة حسب التاريخ)
 */
router.get('/messages', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await db.query(`
            SELECT 
                m.id,
                m.sender_id,
                m.receiver_id,
                m.message,
                m.is_read,
                m.created_at,
                u.name AS sender_name
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.sender_id = $1 OR m.receiver_id = $1
            ORDER BY m.created_at ASC
        `, [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching messages:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * GET /messages/conversations
 * جلب قائمة المحادثات (الأسماء الفريدة الذين تحدثت معهم)
 */
router.get('/messages/conversations', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const conversations = await db.getConversations(userId);
        res.json(conversations);
    } catch (err) {
        console.error('Error fetching conversations:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

module.exports = router;