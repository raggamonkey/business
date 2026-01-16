// server.js - Backend API for Certification Coaching Website
// Run with: node server.js

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Admin credentials
const ADMIN_USERNAME = 'Admin';
const SALT = 'MiloIsAAwesomeCat';
const PASSWORD_HASH = '8ebc456b7a9dc1bb25b7b2fa76f33d6043f71a8f4033d2e12720c1934daf4027';

// Data storage file
const DATA_FILE = path.join(__dirname, 'inquiries.json');

// Initialize data file if it doesn't exist
async function initializeDataFile() {
    try {
        await fs.access(DATA_FILE);
    } catch {
        await fs.writeFile(DATA_FILE, JSON.stringify({ inquiries: [] }), 'utf8');
    }
}

// Read data from file
async function readData() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { inquiries: [] };
    }
}

// Write data to file
async function writeData(data) {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Hash password with SHA-256
function hashPassword(password, salt) {
    return crypto.createHash('sha256').update(password + salt).digest('hex');
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Login endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'Username and password are required' 
        });
    }

    // Verify username
    if (username !== ADMIN_USERNAME) {
        return res.status(401).json({ 
            success: false, 
            message: 'Invalid credentials' 
        });
    }

    // Hash the provided password and compare
    const hashedPassword = hashPassword(password, SALT);
    
    if (hashedPassword === PASSWORD_HASH) {
        res.json({ 
            success: true, 
            message: 'Login successful',
            user: { username: ADMIN_USERNAME }
        });
    } else {
        res.status(401).json({ 
            success: false, 
            message: 'Invalid credentials' 
        });
    }
});

// Contact form submission endpoint
app.post('/api/contact', async (req, res) => {
    const { name, email, certification, message } = req.body;

    // Validation
    if (!name || !email || !certification || !message) {
        return res.status(400).json({ 
            success: false, 
            message: 'All fields are required' 
        });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ 
            success: false, 
            message: 'Invalid email address' 
        });
    }

    try {
        // Create inquiry object
        const inquiry = {
            id: Date.now().toString(),
            name,
            email,
            certification,
            message,
            timestamp: new Date().toISOString(),
            status: 'new'
        };

        // Read existing data
        const data = await readData();
        
        // Add new inquiry
        data.inquiries.push(inquiry);
        
        // Save to file
        await writeData(data);

        // Send email notification (optional - requires email service setup)
        // You can integrate with services like SendGrid, Nodemailer, etc.
        
        res.json({ 
            success: true, 
            message: 'Inquiry submitted successfully',
            inquiryId: inquiry.id
        });
    } catch (error) {
        console.error('Error saving inquiry:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error processing your request. Please try again.' 
        });
    }
});

// Get all inquiries (protected route - should verify admin in production)
app.get('/api/inquiries', async (req, res) => {
    try {
        const data = await readData();
        res.json({ 
            success: true, 
            inquiries: data.inquiries.sort((a, b) => 
                new Date(b.timestamp) - new Date(a.timestamp)
            )
        });
    } catch (error) {
        console.error('Error fetching inquiries:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching inquiries' 
        });
    }
});

// Update inquiry status (protected route)
app.patch('/api/inquiries/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
        return res.status(400).json({ 
            success: false, 
            message: 'Status is required' 
        });
    }

    try {
        const data = await readData();
        const inquiryIndex = data.inquiries.findIndex(inq => inq.id === id);

        if (inquiryIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                message: 'Inquiry not found' 
            });
        }

        data.inquiries[inquiryIndex].status = status;
        data.inquiries[inquiryIndex].updatedAt = new Date().toISOString();

        await writeData(data);

        res.json({ 
            success: true, 
            message: 'Inquiry updated successfully',
            inquiry: data.inquiries[inquiryIndex]
        });
    } catch (error) {
        console.error('Error updating inquiry:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating inquiry' 
        });
    }
});

// Delete inquiry (protected route)
app.delete('/api/inquiries/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const data = await readData();
        const inquiryIndex = data.inquiries.findIndex(inq => inq.id === id);

        if (inquiryIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                message: 'Inquiry not found' 
            });
        }

        data.inquiries.splice(inquiryIndex, 1);
        await writeData(data);

        res.json({ 
            success: true, 
            message: 'Inquiry deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting inquiry:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error deleting inquiry' 
        });
    }
});

// Statistics endpoint
app.get('/api/stats', async (req, res) => {
    try {
        const data = await readData();
        
        const stats = {
            totalInquiries: data.inquiries.length,
            newInquiries: data.inquiries.filter(i => i.status === 'new').length,
            activeClients: data.inquiries.filter(i => i.status === 'active').length,
            completedClients: data.inquiries.filter(i => i.status === 'completed').length,
            certificationBreakdown: {}
        };

        // Count inquiries by certification
        data.inquiries.forEach(inquiry => {
            const cert = inquiry.certification;
            stats.certificationBreakdown[cert] = (stats.certificationBreakdown[cert] || 0) + 1;
        });

        res.json({ 
            success: true, 
            stats 
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching statistics' 
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        success: false, 
        message: 'Something went wrong!' 
    });
});

// Start server
async function startServer() {
    await initializeDataFile();
    app.listen(PORT, () => {
        console.log(`
╔════════════════════════════════════════════╗
║   Certification Coaching API Server       ║
║   Running on http://localhost:${PORT}      ║
╚════════════════════════════════════════════╝

Admin Credentials:
  Username: ${ADMIN_USERNAME}
  (Password is hashed with SHA-256)

Available Endpoints:
  GET    /api/health           - Health check
  POST   /api/login            - Admin login
  POST   /api/contact          - Submit contact form
  GET    /api/inquiries        - Get all inquiries
  PATCH  /api/inquiries/:id    - Update inquiry status
  DELETE /api/inquiries/:id    - Delete inquiry
  GET    /api/stats            - Get statistics

Data stored in: ${DATA_FILE}
        `);
    });
}

startServer().catch(console.error);

module.exports = app;
