require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
// --- IMPORT HUGGING FACE CLIENT ---
const { HfInference } = require('@huggingface/inference');

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_that_is_very_long_and_random';

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// --- FRONTEND DIRECTORY PATH ---
const frontendDir = path.join(__dirname, '..', 'frontend');

// --- DATABASE CONNECTION ---
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_DATABASE || 'demo_5',
    password: process.env.DB_PASSWORD || 'sajid121',
    port: process.env.DB_PORT || 5432,
});

pool.connect((err, client, release) => {
    if (err) {
        return console.error('Error acquiring client', err.stack);
    }
    console.log('Connected to PostgreSQL database.');
    client.release();
});

// --- FILE UPLOAD (MULTER) ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let subDir = 'other';
        if (file.fieldname === 'item-image-input') {
            subDir = 'items';
        } else if (file.fieldname === 'pfpImage') {
            subDir = 'pfp';
        }
        
        const finalDir = path.join(uploadDir, subDir);
        if (!fs.existsSync(finalDir)) {
            fs.mkdirSync(finalDir, { recursive: true });
        }
        cb(null, finalDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueSuffix);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Not an image! Please upload an image.'), false);
    }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

// --- NODEMAILER (EMAIL) SETUP ---
let transporter;

async function setupMail() {
    if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT || 587,
            secure: (process.env.EMAIL_PORT || 587) == 465,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        try {
            await transporter.verify();
            console.log('Nodemailer is ready to send emails.');
        } catch (error) {
            console.error('Nodemailer verification failed:', error);
        }

    } else {
        let testAccount = await nodemailer.createTestAccount();
        console.log(`Nodemailer test account ready: ${testAccount.user}`);
        
        transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
        });
    }
}

setupMail().catch(console.error);

// --- HELPER: SEND STYLED EMAIL ---
async function sendStyledEmail(to, subject, title, bodyContent, actionLink = null, actionText = null) {
    if (!transporter) {
        console.warn('Transporter not ready, skipping email to ' + to);
        return;
    }

    const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f7f6; color: #333; }
            .container { max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
            .header { background-color: #4A90E2; color: #ffffff; padding: 25px; text-align: center; }
            .header h1 { margin: 0; font-size: 26px; font-weight: 600; letter-spacing: 1px; }
            .content { padding: 35px 30px; line-height: 1.6; }
            .greeting { font-size: 18px; font-weight: 600; margin-bottom: 15px; color: #2c3e50; }
            .info-box { background-color: #f8f9fa; border-left: 4px solid #4A90E2; padding: 15px 20px; margin: 20px 0; border-radius: 0 4px 4px 0; }
            .info-box ul { margin: 0; padding-left: 20px; }
            .info-box li { margin-bottom: 8px; }
            .button-container { text-align: center; margin-top: 30px; }
            .button { display: inline-block; background-color: #4A90E2; color: #ffffff !important; padding: 12px 28px; text-decoration: none; border-radius: 50px; font-weight: bold; box-shadow: 0 4px 6px rgba(74, 144, 226, 0.3); transition: background-color 0.3s; }
            .button:hover { background-color: #357abd; }
            .footer { background-color: #f4f7f6; color: #8898aa; text-align: center; padding: 20px; font-size: 13px; border-top: 1px solid #eaeaea; }
            strong { color: #2c3e50; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Campus Reconnect</h1>
            </div>
            <div class="content">
                <div class="greeting">${title}</div>
                ${bodyContent}
                ${actionLink ? `<div class="button-container"><a href="${actionLink}" class="button">${actionText}</a></div>` : ''}
            </div>
            <div class="footer">
                &copy; ${new Date().getFullYear()} Campus Reconnect. Helping you find what's yours.<br>
                This is an automated notification. Please do not reply directly.
            </div>
        </div>
    </body>
    </html>
    `;

    try {
        const info = await transporter.sendMail({
            from: `"Campus Reconnect" <${process.env.EMAIL_USER}>`,
            to: to,
            subject: subject,
            html: htmlTemplate
        });
        console.log(`Styled email sent to ${to}: ${info.messageId}`);
    } catch (error) {
        console.error(`Error sending email to ${to}:`, error);
    }
}

// --- HELPER: Mark Matching Items as Claimed ---
async function markMatchingItemsAsClaimed(claimedItemId, claimedItemType, claimedTitle, claimedDescription, claimedLocation) {
    try {
        const oppositeType = claimedItemType === 'lost' ? 'found' : 'lost';
        const matchQuery = `
            SELECT id, title, description, location, owner_id
            FROM items
            WHERE item_type = $1 
              AND status = 'public'
              AND id != $2
              AND (
                  LOWER(TRIM(title)) = LOWER(TRIM($3))
                  OR (
                      LOWER(title) LIKE LOWER($4)
                      AND (
                          LOWER(location) LIKE LOWER($5)
                          OR (LOWER(description) LIKE LOWER($6) AND $7 IS NOT NULL AND $7 != '')
                      )
                  )
              )
        `;
        
        const titleExact = claimedTitle.trim();
        const titlePartial = `%${claimedTitle.trim()}%`;
        const locPartial = `%${claimedLocation.trim()}%`;
        const descPartial = claimedDescription ? `%${claimedDescription.trim()}%` : null;
        
        const matches = await pool.query(matchQuery, [
            oppositeType, claimedItemId, titleExact, titlePartial, locPartial, descPartial, claimedDescription
        ]);
        
        if (matches.rows.length > 0) {
            const matchIds = matches.rows.map(m => m.id);
            for (const matchId of matchIds) {
                await pool.query("UPDATE items SET status = 'claimed' WHERE id = $1", [matchId]);
                await pool.query("UPDATE claims SET status = 'denied' WHERE item_id = $1 AND status = 'pending'", [matchId]);
            }
            console.log(`Marked ${matches.rows.length} matching ${oppositeType} item(s) as claimed for item "${claimedTitle}"`);
        }
    } catch (error) {
        console.error('Error marking matching items as claimed:', error);
    }
}

// --- HELPER: Find Potential Matches and Send Emails ---
async function checkForMatchesAndNotify(newItemId, newItemType, newTitle, newDescription, newLocation, ownerId) {
    try {
        const oppositeType = newItemType === 'lost' ? 'found' : 'lost';
        const matchQuery = `
            SELECT i.id, i.title, i.description, i.location, i.owner_id, 
                   u.username AS owner_username, u.email AS owner_email
            FROM items i
            JOIN users u ON i.owner_id = u.id
            WHERE i.item_type = $1 
              AND i.status = 'public'
              AND i.id != $2
              AND (
                  LOWER(i.title) LIKE LOWER($3) 
                  OR LOWER(i.description) LIKE LOWER($3)
                  OR LOWER(i.title) LIKE LOWER($4)
                  OR LOWER(i.description) LIKE LOWER($4)
                  OR (LOWER(i.location) LIKE LOWER($5) AND LOWER($5) LIKE LOWER(i.location))
              )
            ORDER BY 
              CASE 
                WHEN LOWER(i.title) = LOWER($6) THEN 1
                WHEN LOWER(i.title) LIKE LOWER($3) OR LOWER(i.title) LIKE LOWER($4) THEN 2
                WHEN LOWER(i.description) LIKE LOWER($3) OR LOWER(i.description) LIKE LOWER($4) THEN 3
                ELSE 4
              END
            LIMIT 3;
        `;
        
        const titleWords = newTitle.split(' ').filter(w => w.length > 2).slice(0, 3);
        const searchTerm1 = titleWords.length > 0 ? `%${titleWords[0]}%` : `%${newTitle.slice(0, 10)}%`;
        const searchTerm2 = titleWords.length > 1 ? `%${titleWords[1]}%` : searchTerm1;
        
        const matches = await pool.query(matchQuery, [
            oppositeType, newItemId, searchTerm1, searchTerm2, `%${newLocation}%`, newTitle
        ]);
        
        if (matches.rows.length > 0 && transporter) {
            const newOwnerResult = await pool.query('SELECT username, email FROM users WHERE id = $1', [ownerId]);
            const newOwner = newOwnerResult.rows[0];
            
            if (newOwner && newOwner.email) {
                const matchesHtml = matches.rows.map(m => 
                    `<li><strong>${m.title}</strong><br><span style="font-size:0.9em; color:#666;">Found at: ${m.location}</span></li>`
                ).join('');

                const body = `
                    <p>Good news! We found potential matches for your <strong>${newItemType === 'lost' ? 'lost' : 'found'}</strong> item: <strong>"${newTitle}"</strong>.</p>
                    <div class="info-box">
                        <p style="margin-top:0; margin-bottom:10px;"><strong>Possible Matches:</strong></p>
                        <ul>${matchesHtml}</ul>
                    </div>
                    <p>Please log in to verify if any of these items match yours.</p>
                `;

                await sendStyledEmail(
                    newOwner.email,
                    `Potential Match: ${newTitle}`,
                    `Hi ${newOwner.username},`,
                    body,
                    "http://localhost:3000", 
                    "View Matches"
                );
            }
            
            for (const match of matches.rows) {
                if (match.owner_email && match.owner_email !== newOwner.email) {
                    const body = `
                        <p>A new item has been reported that closely matches your <strong>${oppositeType === 'lost' ? 'lost' : 'found'}</strong> item: <strong>"${match.title}"</strong>.</p>
                        <div class="info-box">
                            <p style="margin-top:0; margin-bottom:10px;"><strong>New Report Details:</strong></p>
                            <ul>
                                <li><strong>Title:</strong> ${newTitle}</li>
                                <li><strong>Location:</strong> ${newLocation}</li>
                                <li><strong>Description:</strong> ${newDescription || 'No description provided'}</li>
                            </ul>
                        </div>
                        <p>Please check it out to see if it's a match!</p>
                    `;

                    await sendStyledEmail(
                        match.owner_email,
                        `New Potential Match: ${match.title}`,
                        `Hi ${match.owner_username},`,
                        body,
                        "http://localhost:3000",
                        "Check Item"
                    );
                }
            }
        }
    } catch (error) {
        console.error('Error checking for matches:', error);
    }
}

// --- JWT AUTHENTICATION MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ message: 'No token provided' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(401).json({ message: 'Token is invalid or expired' });
        }
        req.user = user;
        next();
    });
};

// --- AUTH ROUTES ---
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password, usn, sem, branch, mobile } = req.body;

    if (!username || !email || !password || !usn || !sem || !branch || !mobile) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUserQuery = `
            INSERT INTO users (username, email, password_hash, usn, semester, branch, mobile, role)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'user')
            RETURNING id, username, email, usn, role;
        `;
        const newUser = await pool.query(newUserQuery, [username, email, hashedPassword, usn, sem, branch, mobile]);
        const user = newUser.rows[0];

        const tokenPayload = {
            id: user.id,
            email: user.email,
            username: user.username,
            usn: user.usn,
            isAdmin: user.role === 'admin'
        };
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1d' });
        
        // Send Welcome Email
        if(user.email) {
            const body = `<p>Welcome to Campus Reconnect! Your account has been successfully created. You can now report lost/found items and claim items belonging to you.</p>`;
            sendStyledEmail(user.email, "Welcome to Campus Reconnect", `Hi ${user.username},`, body, "http://localhost:3000", "Login Now");
        }

        res.status(201).json({ token, user: tokenPayload });

    } catch (error) {
        if (error.code === '23505') {
            if (error.constraint.includes('email')) return res.status(400).json({ message: 'Email already exists' });
            if (error.constraint.includes('usn')) return res.status(400).json({ message: 'USN already exists' });
        }
        console.error('Register error:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { emailOrUsn, password } = req.body;

    if (!emailOrUsn || !password) {
        return res.status(400).json({ message: 'Email/USN and password are required' });
    }

    try {
        const query = `SELECT id, username, email, usn, password_hash, role, has_pfp FROM users WHERE email = $1 OR usn = $1;`;
        const result = await pool.query(query, [emailOrUsn]);
        const user = result.rows[0];

        if (!user) return res.status(401).json({ message: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

        const tokenPayload = {
            id: user.id,
            email: user.email,
            username: user.username,
            usn: user.usn,
            isAdmin: user.role === 'admin'
        };
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1d' });
        res.status(200).json({ token, user: tokenPayload });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const query = `SELECT id, username, email, usn, semester, branch, mobile, role, has_pfp FROM users WHERE id = $1;`;
        const result = await pool.query(query, [req.user.id]);
        const user = result.rows[0];
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.status(200).json(user);
    } catch (error) {
        console.error('Get user profile error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/auth/upload-pfp', authenticateToken, upload.single('pfpImage'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    try {
        const imagePath = `uploads/pfp/${req.file.filename}`;
        const oldPathResult = await pool.query('SELECT pfp_path FROM users WHERE id = $1', [req.user.id]);
        const oldPath = oldPathResult.rows[0]?.pfp_path;

        await pool.query('UPDATE users SET has_pfp = TRUE, pfp_path = $1 WHERE id = $2', [imagePath, req.user.id]);

        if (oldPath && fs.existsSync(path.join(__dirname, oldPath))) {
            fs.unlinkSync(path.join(__dirname, oldPath));
        }
        res.status(200).json({ message: 'Profile picture updated', path: imagePath });
    } catch (error) {
        console.error('PFP upload error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// --- IMAGE ROUTES ---
app.get('/api/image/item/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT image_path FROM items WHERE id = $1', [req.params.id]);
        const imagePath = result.rows[0]?.image_path;
        if (!imagePath || !fs.existsSync(path.join(__dirname, imagePath))) return res.status(404).json({ message: 'Image not found' });
        res.sendFile(path.join(__dirname, imagePath));
    } catch (error) {
        console.error('Get item image error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/image/pfp/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT pfp_path FROM users WHERE id = $1 AND has_pfp = TRUE', [req.params.id]);
        const pfpPath = result.rows[0]?.pfp_path;
        if (!pfpPath || !fs.existsSync(path.join(__dirname, pfpPath))) return res.status(404).json({ message: 'Image not found' });
        res.sendFile(path.join(__dirname, pfpPath));
    } catch (error) {
        console.error('Get pfp image error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// --- AI ROUTE (UPDATED TO HUGGING FACE - QWEN 2.5) ---
app.post('/api/ai/analyze-image', authenticateToken, async (req, res) => {
    const { image } = req.body;
    if (!image) {
        return res.status(400).json({ message: 'No image data provided' });
    }

    try {
        const hfToken = process.env.HF_TOKEN;
        if (!hfToken) {
            return res.status(500).json({ message: 'Hugging Face Token not configured' });
        }

        const hf = new HfInference(hfToken);
        
        // Prompt optimized for JSON structure
        const prompt = `
            Analyze this image and return a VALID JSON object (no markdown, no backticks).
            Structure:
            {
                "itemName": "Concise Name (max 4 words)",
                "description": "Detailed description of appearance, brand, condition, and unique features."
            }
        `;

        // Using Qwen2.5-VL-7B-Instruct (Explicitly allowed in your error log)
        const result = await hf.chatCompletion({
            model: "Qwen/Qwen2.5-VL-7B-Instruct", 
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image}` } }
                    ]
                }
            ],
            max_tokens: 300,
            temperature: 0.1
        });

        if (result.choices && result.choices[0] && result.choices[0].message) {
            const content = result.choices[0].message.content;
            
            // Clean and parse JSON
            try {
                const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(cleanJson);
                
                res.status(200).json({
                    itemName: parsed.itemName || "Analyzed Item",
                    description: parsed.description || "Description unavailable"
                });
            } catch (e) {
                console.error("JSON Parse failed, using raw text");
                // Fallback if model refused JSON format
                res.status(200).json({
                    itemName: "Item Detected",
                    description: content
                });
            }
        } else {
            throw new Error("Invalid response from Hugging Face");
        }

    } catch (error) {
        console.error('AI analysis error:', error);
        // Fallback if HF fails
        res.status(500).json({ message: `AI Analysis failed: ${error.message}` });
    }
});

// --- ITEM & REPORT ROUTES ---
app.get('/api/items/stats', async (req, res) => {
    try {
        const statsQuery = `
            SELECT 
                COUNT(*) FILTER (WHERE item_type = 'lost' AND status = 'public') AS lost_count,
                COUNT(*) FILTER (WHERE item_type = 'found' AND status = 'public') AS found_count
            FROM items;
        `;
        const statsResult = await pool.query(statsQuery);
        const recentQuery = `SELECT id, title, item_type FROM items WHERE status = 'public' ORDER BY created_at DESC LIMIT 5;`;
        const recentResult = await pool.query(recentQuery);

        res.status(200).json({ ...statsResult.rows[0], recent_items: recentResult.rows });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/items/public/lost', async (req, res) => {
    try {
        const query = `SELECT id, title, description, location, has_image, created_at, item_type FROM items WHERE item_type = 'lost' AND status = 'public' ORDER BY created_at DESC;`;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Get lost items error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/items/public/found', async (req, res) => {
    try {
        const query = `SELECT id, title, description, location, has_image, created_at, item_type FROM items WHERE item_type = 'found' AND status = 'public' ORDER BY created_at DESC;`;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Get found items error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/reports/my-reports', authenticateToken, async (req, res) => {
    try {
        const query = `
            SELECT i.id, i.title, i.description, i.location, i.has_image, i.created_at, i.item_type, i.status, c.id AS pending_claim_id
            FROM items i
            LEFT JOIN claims c ON c.item_id = i.id AND c.status = 'pending'
            WHERE i.owner_id = $1
            ORDER BY i.created_at DESC;
        `;
        const result = await pool.query(query, [req.user.id]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Get my reports error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/reports/new', authenticateToken, upload.single('item-image-input'), async (req, res) => {
    const title = req.body['item-title'];
    const location = req.body['item-location'];
    const description = req.body['item-description'];
    const type = req.body['item-status'];
    
    if (!title || !location || !type) return res.status(400).json({ message: 'Title, location, and status are required' });

    try {
        const imagePath = req.file ? `uploads/items/${req.file.filename}` : null;
        const hasImage = !!req.file;

        const query = `
            INSERT INTO items (owner_id, title, location, description, item_type, image_path, has_image, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'public')
            RETURNING *;
        `;
        const newItem = await pool.query(query, [req.user.id, title, location, description, type, imagePath, hasImage]);
        const createdItem = newItem.rows[0];
        
        checkForMatchesAndNotify(createdItem.id, type, title, description, location, req.user.id).catch(console.error);
        res.status(201).json(createdItem);
    } catch (error) {
        console.error('New report error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

app.patch('/api/reports/remove/:itemId', authenticateToken, async (req, res) => {
    const itemId = req.params.itemId;
    const userId = req.user.id;
    try {
        const itemResult = await pool.query('SELECT id, owner_id, status FROM items WHERE id = $1', [itemId]);
        const item = itemResult.rows[0];

        if (!item) return res.status(404).json({ message: 'Item not found' });
        if (item.owner_id !== userId) return res.status(403).json({ message: 'Permission denied' });
        if (item.status !== 'public') return res.status(400).json({ message: 'Only public items can be removed' });

        await pool.query("UPDATE items SET status = 'archived' WHERE id = $1", [itemId]);
        res.status(200).json({ message: 'Item removed successfully' });
    } catch (error) {
        console.error('Remove item error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// --- CLAIM ROUTES ---
app.get('/api/claims/setup/:itemId', authenticateToken, async (req, res) => {
    try {
        const itemQuery = `
            SELECT i.id, i.title, i.item_type, i.owner_id, u.username AS owner_username, u.has_pfp AS owner_has_pfp
            FROM items i JOIN users u ON i.owner_id = u.id WHERE i.id = $1;
        `;
        const itemResult = await pool.query(itemQuery, [req.params.itemId]);
        const item = itemResult.rows[0];
        if (!item) return res.status(404).json({ message: 'Item not found' });

        const claimerResult = await pool.query('SELECT id, username, has_pfp FROM users WHERE id = $1', [req.user.id]);
        const claimer = claimerResult.rows[0];
        
        res.status(200).json({
            item: { id: item.id, title: item.title, item_type: item.item_type },
            owner: { id: item.owner_id, username: item.owner_username, has_pfp: item.owner_has_pfp },
            claimer: { id: claimer.id, username: claimer.username, has_pfp: claimer.has_pfp }
        });
    } catch (error) {
        console.error('Claim setup error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/claims/new', authenticateToken, async (req, res) => {
    const { itemId, verificationText } = req.body;
    const claimerId = req.user.id;

    try {
        const itemResult = await pool.query('SELECT owner_id, title FROM items WHERE id = $1', [itemId]);
        const item = itemResult.rows[0];
        if (!item) return res.status(404).json({ message: 'Item not found' });
        if (item.owner_id === claimerId) return res.status(400).json({ message: 'Cannot claim own item' });

        const existing = await pool.query('SELECT * FROM claims WHERE item_id=$1 AND claimer_id=$2 AND status=$3', [itemId, claimerId, 'pending']);
        if (existing.rows.length > 0) return res.status(400).json({ message: 'Already claimed' });

        const newClaim = await pool.query(
            'INSERT INTO claims (item_id, claimer_id, owner_id, verification_text, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [itemId, claimerId, item.owner_id, verificationText || null, 'pending']
        );
        
        await pool.query("UPDATE items SET status = 'pending' WHERE id = $1", [itemId]);
        
        const owner = (await pool.query('SELECT email, username FROM users WHERE id=$1', [item.owner_id])).rows[0];
        const claimer = (await pool.query('SELECT username FROM users WHERE id=$1', [claimerId])).rows[0];

        if (owner && owner.email) {
            const body = `
                <p><strong>${claimer.username}</strong> has submitted a claim for your item: <strong>"${item.title}"</strong>.</p>
                <div class="info-box">
                    <p style="margin-top:0;"><strong>Verification Details Provided:</strong></p>
                    <p><em>"${verificationText || 'None provided'}"</em></p>
                </div>
                <p>Please log in to your dashboard to review this claim and accept or deny it.</p>
            `;

            sendStyledEmail(
                owner.email,
                `Action Required: Claim for "${item.title}"`,
                `Hi ${owner.username},`,
                body,
                "http://localhost:3000",
                "Review Claim"
            );
        }
        
        res.status(201).json({ message: 'Claim submitted', claimId: newClaim.rows[0].id });
    } catch (error) {
        console.error('New claim error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/claims/review/:claimId', authenticateToken, async (req, res) => {
    try {
        const query = `
            SELECT c.id, c.verification_text, i.id AS item_id, i.title AS item_title,
                   u.id AS claimer_id, u.username AS claimer_username, u.email AS claimer_email, u.has_pfp AS claimer_has_pfp
            FROM claims c JOIN items i ON c.item_id = i.id JOIN users u ON c.claimer_id = u.id
            WHERE c.id = $1 AND i.owner_id = $2 AND c.status = 'pending';
        `;
        const result = await pool.query(query, [req.params.claimId, req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Claim not found' });
        
        const data = result.rows[0];
        res.status(200).json({
            claim: { id: data.id, verification_text: data.verification_text },
            item: { id: data.item_id, title: data.item_title },
            claimer: { id: data.claimer_id, username: data.claimer_username, email: data.claimer_email, has_pfp: data.claimer_has_pfp }
        });
    } catch (error) {
        console.error('Review claim error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/claims/decide', authenticateToken, async (req, res) => {
    const { claimId, decision } = req.body;
    const ownerId = req.user.id;
    try {
        const claim = (await pool.query('SELECT * FROM claims WHERE id=$1', [claimId])).rows[0];
        if (!claim) return res.status(404).json({ message: 'Claim not found' });

        const item = (await pool.query('SELECT * FROM items WHERE id=$1 AND owner_id=$2', [claim.item_id, ownerId])).rows[0];
        if (!item) return res.status(403).json({ message: 'Not owner' });

        if (decision === 'confirmed') {
            await pool.query("UPDATE claims SET status = 'confirmed' WHERE id = $1", [claimId]);
            await pool.query("UPDATE items SET status = 'claimed' WHERE id = $1", [item.id]);
            await pool.query("UPDATE claims SET status = 'denied' WHERE item_id = $1 AND id != $2", [item.id, claimId]);
            markMatchingItemsAsClaimed(item.id, item.item_type, item.title, item.description, item.location).catch(console.error);
        } else if (decision === 'denied') {
            await pool.query("UPDATE claims SET status = 'denied' WHERE id = $1", [claimId]);
            const otherClaims = await pool.query("SELECT * FROM claims WHERE item_id = $1 AND status = 'pending'", [item.id]);
            if (otherClaims.rows.length === 0) await pool.query("UPDATE items SET status = 'public' WHERE id = $1", [item.id]);
        } else {
            return res.status(400).json({ message: 'Invalid decision' });
        }
        
        const claimer = (await pool.query('SELECT email, username FROM users WHERE id=$1', [claim.claimer_id])).rows[0];
        // FETCH OWNER CONTACT DETAILS HERE
        const owner = (await pool.query('SELECT email, username, mobile FROM users WHERE id=$1', [ownerId])).rows[0];

        if (claimer && claimer.email) {
            let body = `<p>The owner (${owner.username}) has <strong>${decision}</strong> your claim for the item: <strong>"${item.title}"</strong>.</p>`;
            
            if (decision === 'confirmed') {
                body += `
                <div class="info-box">
                    <p style="margin-top:0;"><strong>Owner Contact Details:</strong></p>
                    <ul>
                        <li><strong>Name:</strong> ${owner.username}</li>
                        <li><strong>Mobile:</strong> ${owner.mobile || 'Not provided'}</li>
                        <li><strong>Email:</strong> <a href="mailto:${owner.email}">${owner.email}</a></li>
                    </ul>
                    <p>Please contact them directly to arrange the return of your item.</p>
                </div>`;
            }

            sendStyledEmail(
                claimer.email,
                `Claim Update: ${item.title}`,
                `Hi ${claimer.username},`,
                body,
                "http://localhost:3000",
                "View Status"
            );
        }
        res.status(200).json({ message: `Claim ${decision}` });
    } catch (error) {
        console.error('Claim decision error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query || query.length < 1) return res.json([]);
    try {
        const results = await pool.query(`
            SELECT id, title, location, item_type, has_image FROM items
            WHERE status = 'public' AND (title ILIKE $1 OR location ILIKE $1 OR description ILIKE $1)
            ORDER BY created_at DESC LIMIT 10;
        `, [`%${query}%`]);
        res.status(200).json(results.rows);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// --- ADMIN ROUTES ---
const adminOnly = (req, res, next) => {
    if (!req.user || !req.user.isAdmin) return res.status(403).json({ message: 'Forbidden' });
    next();
};

app.get('/api/admin/dashboard', authenticateToken, adminOnly, async (req, res) => {
    try {
        const stats = (await pool.query(`SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM items) AS items, (SELECT COUNT(*) FROM claims WHERE status = 'pending') AS claims`)).rows[0];
        const users = (await pool.query(`SELECT u.id, u.username, u.email, u.usn, COUNT(i.id) AS report_count FROM users u LEFT JOIN items i ON u.id = i.owner_id GROUP BY u.id ORDER BY u.username`)).rows;
        const items = (await pool.query(`SELECT i.id, i.title, i.item_type, i.status, u.username AS owner_username FROM items i JOIN users u ON i.owner_id = u.id ORDER BY i.created_at DESC`)).rows;
        res.status(200).json({ stats, users, items });
    } catch (error) {
        console.error('Admin dash error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.delete('/api/admin/items/:id', authenticateToken, adminOnly, async (req, res) => {
    try {
        const item = (await pool.query('SELECT image_path FROM items WHERE id = $1', [req.params.id])).rows[0];
        await pool.query('DELETE FROM claims WHERE item_id = $1', [req.params.id]);
        await pool.query('DELETE FROM items WHERE id = $1', [req.params.id]);
        if (item && item.image_path && fs.existsSync(path.join(__dirname, item.image_path))) fs.unlinkSync(path.join(__dirname, item.image_path));
        res.status(204).send();
    } catch (error) {
        console.error('Admin delete item error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.delete('/api/admin/users/:email', authenticateToken, adminOnly, async (req, res) => {
    try {
        const user = (await pool.query('SELECT * FROM users WHERE email = $1', [req.params.email])).rows[0];
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.email === 'admin@campus.reconnect') return res.status(403).json({ message: 'Cannot delete primary admin' });

        if (user.pfp_path && fs.existsSync(path.join(__dirname, user.pfp_path))) fs.unlinkSync(path.join(__dirname, user.pfp_path));
        await pool.query('DELETE FROM claims WHERE claimer_id = $1', [user.id]);
        
        const items = (await pool.query('SELECT id, image_path FROM items WHERE owner_id = $1', [user.id])).rows;
        for (const item of items) {
            await pool.query('DELETE FROM claims WHERE item_id = $1', [item.id]);
            await pool.query('DELETE FROM items WHERE id = $1', [item.id]);
            if (item.image_path && fs.existsSync(path.join(__dirname, item.image_path))) fs.unlinkSync(path.join(__dirname, item.image_path));
        }
        
        await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
        res.status(204).send();
    } catch (error) {
        console.error('Admin delete user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// --- STATIC & CATCH-ALL ---
app.use(express.static(frontendDir));
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
    res.sendFile(path.join(frontendDir, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});