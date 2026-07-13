require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/healthverse';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database Connection
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Schemas & Models
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  protocol: {
    age: { type: Number },
    biologicalSex: { type: String },
    height: { type: Number },
    weight: { type: Number },
    occupation: { type: String },
    activityLevel: { type: String },
    goals: [{ type: String }]
  }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// API Routes

// 1. Signup Route
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'Account already exists with this email.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const newUser = new User({
      name,
      email: email.toLowerCase(),
      password: hashedPassword
    });

    await newUser.save();
    res.status(201).json({ message: 'Account initialized.', email: newUser.email, name: newUser.name });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to process signup.' });
  }
});

// 2. Login Route
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    // Check user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    res.status(200).json({ message: 'Access granted.', email: user.email, name: user.name });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to process login.' });
  }
});

// Google Authentication Configurations API
app.get('/api/auth/google-config', (req, res) => {
  res.status(200).json({ googleClientId: process.env.GOOGLE_CLIENT_ID || '' });
});

// Google Authentication API
app.post('/api/auth/google', async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email || !name) {
      return res.status(400).json({ error: 'Google email and name are required.' });
    }

    const normalizedEmail = email.toLowerCase();
    let user = await User.findOne({ email: normalizedEmail });
    let isNewUser = false;

    if (!user) {
      // User is registering via Google for the first time
      isNewUser = true;

      // Hash a random placeholder password since schema requires password
      const randomPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(randomPassword, salt);

      user = new User({
        name,
        email: normalizedEmail,
        password: hashedPassword
      });

      await user.save();
    }

    res.status(200).json({
      message: isNewUser ? 'Account initialized.' : 'Access granted.',
      email: user.email,
      name: user.name,
      isNewUser
    });
  } catch (error) {
    console.error('Google Auth error:', error);
    res.status(500).json({ error: 'Failed to process Google authentication.' });
  }
});

// 3. Save/Update Protocol Telemetry Route
app.post('/api/user/protocol', async (req, res) => {
  try {
    const { email, age, biologicalSex, height, weight, occupation, activityLevel, goals } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'User email is required to save protocol.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    // Update protocol telemetry
    user.protocol = {
      age: age ? Number(age) : undefined,
      biologicalSex,
      height: height ? Number(height) : undefined,
      weight: weight ? Number(weight) : undefined,
      occupation,
      activityLevel,
      goals
    };

    await user.save();
    res.status(200).json({ message: 'Telemetry calibrated successfully.' });
  } catch (error) {
    console.error('Save protocol error:', error);
    res.status(500).json({ error: 'Failed to save protocol telemetry.' });
  }
});

// Serve Static Frontend files from root
app.use(express.static(path.join(__dirname)));

// Fallback to signup page if non-matching HTML
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Export app for Vercel serverless deployments
module.exports = app;

// Start local server if run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}
