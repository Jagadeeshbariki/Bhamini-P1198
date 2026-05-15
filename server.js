
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'bhamini_secure_p1198_key_2024';

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['field', 'project', 'admin', 'da'], default: 'field' }
});

const ImageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  fileName: { type: String },
  type: { type: String, enum: ['slider', 'gallery'], default: 'gallery' },
  activity: { type: String, default: 'Uncategorized' },
  uploadedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Image = mongoose.model('Image', ImageSchema);

if (MONGO_URI) {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected Successfully'))
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err.message);
    });
}

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ message: 'Access denied. Please log in again.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Session expired. Please log in again.' });
    req.user = user;
    next();
  });
};

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    if (!username || !email || !password) return res.status(400).json({ message: 'Missing fields' });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User with this email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ 
        username, 
        email, 
        password: hashedPassword, 
        role: role || 'field'
    });
    
    await newUser.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ message: 'Registration failed', error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'User not found' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ 
      id: user._id, 
      username: user.username, 
      email: user.email, 
      role: user.role,
      isAdmin: user.role === 'admin' 
    }, JWT_SECRET, { expiresIn: '12h' });

    res.json({ token, user: { username: user.username, email: user.email, role: user.role, isAdmin: user.role === 'admin' } });
  } catch (err) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.post('/api/images/upload', authenticateToken, async (req, res) => {
  try {
    const { imageBase64, fileName, type, activity } = req.body;
    if (!imageBase64) return res.status(400).json({ message: 'No image data provided' });
    const sizeInBytes = Buffer.byteLength(imageBase64, 'utf8');
    if (sizeInBytes > 15 * 1024 * 1024) return res.status(413).json({ message: 'Image too large (Max 15MB)' });

    const newImage = new Image({ 
        url: imageBase64, 
        fileName: fileName || 'upload.png',
        type: type || 'gallery',
        activity: activity || 'Uncategorized'
    });
    await newImage.save();
    res.status(201).json({ message: 'Image uploaded successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error during upload', error: err.message });
  }
});

app.get('/api/images', async (req, res) => {
  try {
    const images = await Image.find().sort({ uploadedAt: -1 }).limit(50);
    res.json(images);
  } catch (err) {
    res.status(500).json([]);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
