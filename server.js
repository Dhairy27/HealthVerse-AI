require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fitforge';

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
    goals: [{ type: String }],
    location: { type: String },
    equipment: [{ type: String }],
    duration: { type: Number },
    fitnessLevel: { type: String }
  },
  workoutPlan: { type: Object, default: null },
  dietProfile: {
    dietaryType: { type: String, default: 'non-vegetarian' },
    allergies: [{ type: String }],
    budget: { type: String, default: 'mid' },
    dailyCalories: { type: Number, default: 2000 }
  },
  dietPlan: { type: Object, default: null },
  subscription: {
    plan: { type: String, enum: ['none', 'trial', 'monthly', '6month', '12month'], default: 'none' },
    status: { type: String, enum: ['none', 'active', 'canceled', 'expired'], default: 'none' },
    trialStart: { type: Date, default: null },
    trialEnd: { type: Date, default: null },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null }
  },
  resetOTP: { type: String, default: null },
  resetOTPExpires: { type: Date, default: null }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

const workoutSchema = new mongoose.Schema({
  email: { type: String, required: true },
  workoutName: { type: String, default: 'Custom Session' },
  duration: { type: Number, required: true }, // in seconds
  steps: { type: Number, required: true },
  distance: { type: Number, required: true }, // in meters
  calories: { type: Number },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

const Workout = mongoose.model('Workout', workoutSchema);

const nutritionLogSchema = new mongoose.Schema({
  email: { type: String, required: true },
  foodName: { type: String, required: true },
  calories: { type: Number, required: true },
  protein: { type: Number, default: 0 },
  carbs: { type: Number, default: 0 },
  fat: { type: Number, default: 0 },
  fiber: { type: Number, default: 0 },
  sugar: { type: Number, default: 0 },
  sodium: { type: Number, default: 0 },
  cholesterol: { type: Number, default: 0 },
  potassium: { type: Number, default: 0 },
  healthAnalysis: { type: Object, default: null },
  recommendations: { type: Object, default: null },
  items: { type: Array, default: [] },
  imageUrl: { type: String },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

const NutritionLog = mongoose.model('NutritionLog', nutritionLogSchema);


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

// Nodemailer transporter helper
const getEmailTransporter = () => {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  
  if (!emailUser || !emailPass) {
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser,
      pass: emailPass
    }
  });
};

// 2a. Forgot Password Route - Generates and sends OTP
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'No account registered with this email.' });
    }

    // Generate 6-digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins validity

    user.resetOTP = otp;
    user.resetOTPExpires = expires;
    await user.save();

    const transporter = getEmailTransporter();
    if (!transporter) {
      console.warn('Gmail credentials not set in .env. Logging OTP code:');
      console.log(`[FORGOT PASSWORD OTP FOR ${user.email}]: ${otp}`);
      return res.status(200).json({ 
        message: 'Verification code generated.', 
        note: 'Email system offline. Verification code printed in server console logs.' 
      });
    }

    const mailOptions = {
      from: `"FitForge" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'FitForge Password Reset Verification Code',
      text: `Hello ${user.name},\n\nWe received a request to reset your FitForge account password. Please use the following 6-digit verification code to proceed:\n\n${otp}\n\nThis code is valid for 15 minutes. If you did not make this request, you can safely ignore this email.\n\nBest regards,\nFitForge Support Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
          <h2 style="color: #131313; text-align: center; border-bottom: 2px solid #131313; padding-bottom: 10px;">FitForge Password Reset</h2>
          <p style="color: #555555; font-size: 16px;">Hello ${user.name},</p>
          <p style="color: #555555; font-size: 16px;">We received a request to reset your FitForge account password. Please use the verification code below to proceed:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #131313; background-color: #f5f5f5; padding: 12px 24px; border-radius: 6px; border: 1px solid #cccccc;">${otp}</span>
          </div>
          <p style="color: #888888; font-size: 12px; text-align: center;">This code is valid for 15 minutes. If you did not make this request, please ignore this email.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Verification code sent to your email.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process forgot password request.' });
  }
});

// 2b. Reset Password Route - Verifies OTP and updates password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Verify OTP and Expiration
    if (!user.resetOTP || user.resetOTP !== otp) {
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    if (!user.resetOTPExpires || new Date() > new Date(user.resetOTPExpires)) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    user.resetOTP = null;
    user.resetOTPExpires = null;
    await user.save();

    res.status(200).json({ message: 'Password has been successfully updated.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// 3. Save/Update Protocol Telemetry Route
app.post('/api/user/protocol', async (req, res) => {
  try {
    const { email, age, biologicalSex, height, weight, occupation, activityLevel, goals, location, equipment, duration, fitnessLevel } = req.body;
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
      goals,
      location,
      equipment,
      duration: duration ? Number(duration) : undefined,
      fitnessLevel
    };

    await user.save();
    res.status(200).json({ message: 'Telemetry calibrated successfully.' });
  } catch (error) {
    console.error('Save protocol error:', error);
    res.status(500).json({ error: 'Failed to save protocol telemetry.' });
  }
});

// 4. Get User Protocol Route
app.get('/api/user/protocol', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: 'User email is required.' });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.status(200).json({ protocol: user.protocol || {} });
  } catch (error) {
    console.error('Get protocol error:', error);
    res.status(500).json({ error: 'Failed to retrieve protocol telemetry.' });
  }
});

// 4b. Get User Profile Route
app.get('/api/user/profile', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: 'User email is required.' });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.status(200).json({
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      protocol: user.protocol || {}
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to retrieve user profile.' });
  }
});

// 4b2. Subscription Routes

// A. Get subscription status
app.get('/api/user/subscription', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: 'User email is required.' });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    let sub = user.subscription || { plan: 'none', status: 'none' };
    let hasChanged = false;

    // Check if subscription has expired
    if (sub.status === 'active' || sub.status === 'canceled') {
      const now = new Date();
      if (sub.plan === 'trial') {
        if (sub.trialEnd && now > new Date(sub.trialEnd)) {
          sub.status = 'expired';
          sub.plan = 'none';
          hasChanged = true;
        }
      } else {
        if (sub.endDate && now > new Date(sub.endDate)) {
          if (sub.status === 'active') {
            // Mock auto-renewal for paid subscriptions
            const durationMs = new Date(sub.endDate) - new Date(sub.startDate);
            sub.startDate = new Date();
            sub.endDate = new Date(Date.now() + durationMs);
            hasChanged = true;
          } else {
            // Cancelled subscription finished its term -> expired
            sub.status = 'expired';
            sub.plan = 'none';
            hasChanged = true;
          }
        }
      }
    }

    if (hasChanged) {
      user.subscription = sub;
      await user.save();
    }

    res.status(200).json({ subscription: sub });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Failed to retrieve subscription status.' });
  }
});

// B. Subscribe/Start Trial
app.post('/api/user/subscribe', async (req, res) => {
  try {
    const { email, plan } = req.body;
    if (!email || !plan) {
      return res.status(400).json({ error: 'Email and plan are required.' });
    }

    const validPlans = ['trial', 'monthly', '6month', '12month'];
    if (!validPlans.includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan selection.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Initialize subscription object if not present
    if (!user.subscription) {
      user.subscription = { plan: 'none', status: 'none', trialStart: null, trialEnd: null, startDate: null, endDate: null };
    }

    const now = new Date();

    if (plan === 'trial') {
      // Check if they already had a trial
      if (user.subscription.trialStart) {
        return res.status(400).json({ error: 'You have already exhausted your 15-day free trial.' });
      }

      user.subscription.plan = 'trial';
      user.subscription.status = 'active';
      user.subscription.trialStart = now;
      user.subscription.trialEnd = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days
    } else {
      // Paid plan subscription (monthly, 6month, 12month)
      let durationMs = 30 * 24 * 60 * 60 * 1000; // default 30 days
      if (plan === '6month') {
        durationMs = 6 * 30 * 24 * 60 * 60 * 1000;
      } else if (plan === '12month') {
        durationMs = 365 * 24 * 60 * 60 * 1000;
      }

      user.subscription.plan = plan;
      user.subscription.status = 'active';
      user.subscription.startDate = now;
      user.subscription.endDate = new Date(now.getTime() + durationMs);
    }

    await user.save();
    res.status(200).json({ message: 'Subscription successfully activated.', subscription: user.subscription });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ error: 'Failed to update subscription.' });
  }
});

// C. Cancel subscription
app.post('/api/user/cancel-subscription', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'User email is required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (!user.subscription || user.subscription.status === 'none' || user.subscription.status === 'expired') {
      return res.status(400).json({ error: 'No active subscription or trial found to cancel.' });
    }

    if (user.subscription.plan === 'trial') {
      // Cancelling trial terminates it immediately
      user.subscription.plan = 'none';
      user.subscription.status = 'none';
      user.subscription.trialEnd = new Date(); // end it now
    } else {
      // Paid subscription is set to canceled, but remains active until end date
      user.subscription.status = 'canceled';
    }

    await user.save();
    res.status(200).json({ message: 'Subscription canceled successfully.', subscription: user.subscription });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription.' });
  }
});

// 4c. Get Saved Workout Plan
app.get('/api/user/workout-plan', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: 'User email is required.' });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.status(200).json({ plan: user.workoutPlan });
  } catch (error) {
    console.error('Get workout plan error:', error);
    res.status(500).json({ error: 'Failed to retrieve workout plan.' });
  }
});

// 4d. Generate & Save Adaptive AI Workout Plan
app.post('/api/user/workout-plan', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'User email is required.' });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const proto = user.protocol || {};
    if (!proto.age || !proto.height || !proto.weight || !proto.biologicalSex) {
      return res.status(400).json({ error: 'Onboarding telemetry incomplete. Please fill out details first.' });
    }

    // Determine strategy based on goals
    const goalsStr = (proto.goals || []).join(' ').toLowerCase();
    let planType = 'General Physical Preparedness';
    let planDescription = 'Balanced weekly split focusing on overall functional strength, stability, and cardiovascular health.';

    // Base volume parameters based on Fitness Level
    let sets = 3;
    let restSecs = 90;
    let volumeTag = 'Beginner';
    const fitLevel = (proto.fitnessLevel || 'beginner').toLowerCase();

    if (fitLevel === 'intermediate') {
      sets = 4;
      restSecs = 60;
      volumeTag = 'Intermediate';
    } else if (fitLevel === 'advanced') {
      sets = 4;
      restSecs = 45;
      volumeTag = 'Advanced';
    }

    // Adjust for age
    let jointFriendly = false;
    if (proto.age > 50) {
      jointFriendly = true;
      sets = Math.max(2, sets - 1);
      restSecs += 15;
    }

    const placeholderImg = 'https://lh3.googleusercontent.com/aida-public/AB6AXuC0X97aehtRdspJEqsisVKwrnSLo5h8WOAxfdIzFTRcccc-qrXGFS0CZEglW_kPGCm9M2-c34lO-M7BJdvbwSXpAn1B8xGkOvrTYo8qEIbi-lDBMQ4PkBY3c_kzmYpaCMLyAl2Cn2yBRoXLwUzp1P9y8HXAWL_4xjUBoZ1D90rG_rbonxYyP8hOyyvlS7L6nVGS4LW4XtZN0pFWAuSXS_5PRrzVNQDtWfKvROrKYDyQiLxyF1o-p8eN';

    // Helper functions for adaptive equipment substitutions
    const isHome = (proto.location || 'gym').toLowerCase() === 'home';
    const equip = (proto.equipment || []).map(e => e.toLowerCase());

    function adaptExercise(ex) {
      const name = ex.name;
      let adaptedName = name;

      const hasDumbbells = equip.includes('dumbbells') || equip.includes('dumbbell');
      const hasKettlebell = equip.includes('kettlebell');
      const hasBands = equip.includes('resistance bands') || equip.includes('resistance_bands') || equip.includes('bands');
      const hasBarbell = equip.includes('barbell');
      const hasPullup = equip.includes('pull-up bar') || equip.includes('pull_up_bar') || equip.includes('pullup');

      if (name.includes("Goblet Squat") && !hasDumbbells && !hasKettlebell) {
        adaptedName = "Bodyweight Squats";
      } else if (name.includes("Barbell") && !hasBarbell) {
        if (hasDumbbells) {
          adaptedName = name.replace("Barbell", "Dumbbell");
        } else if (hasKettlebell) {
          adaptedName = name.replace("Barbell", "Kettlebell");
        } else if (hasBands) {
          adaptedName = name.replace("Barbell", "Resistance Band");
        } else {
          if (name.includes("Squats") || name.includes("Squat")) adaptedName = "Bodyweight Squats";
          else if (name.includes("Bench Press") || name.includes("Chest Press") || name.includes("Press")) adaptedName = "Bodyweight Pushups";
          else if (name.includes("Deadlift")) adaptedName = "Single-Leg Bodyweight Romanian Deadlifts";
          else if (name.includes("Row")) adaptedName = "Doorframe Bodyweight Rows";
          else adaptedName = "Bodyweight Squats";
        }
      } else if (name.includes("Dumbbell") && !hasDumbbells) {
        if (hasBarbell) {
          adaptedName = name.replace("Dumbbell", "Barbell");
        } else if (hasKettlebell) {
          adaptedName = name.replace("Dumbbell", "Kettlebell");
        } else if (hasBands) {
          adaptedName = name.replace("Dumbbell", "Resistance Band");
        } else {
          if (name.includes("Squats") || name.includes("Squat") || name.includes("Lunges") || name.includes("Lunge")) adaptedName = "Bodyweight Squats";
          else if (name.includes("Bench Press") || name.includes("Press")) adaptedName = "Bodyweight Pushups";
          else if (name.includes("Row")) adaptedName = "Bodyweight Towel Rows";
          else if (name.includes("Curls") || name.includes("Curl")) adaptedName = "Bodyweight Arm Isometric Holds";
          else adaptedName = "Bodyweight Squats";
        }
      } else if (name.includes("Kettlebell") && !hasKettlebell) {
        if (hasDumbbells) {
          adaptedName = name.replace("Kettlebell", "Dumbbell");
        } else if (hasBarbell) {
          adaptedName = name.replace("Kettlebell", "Barbell");
        } else if (hasBands) {
          adaptedName = name.replace("Kettlebell", "Resistance Band");
        } else {
          if (name.includes("Swings") || name.includes("Swing")) adaptedName = "Bodyweight Jump Squats";
          else if (name.includes("Squat")) adaptedName = "Bodyweight Squats";
          else adaptedName = "Bodyweight Squats";
        }
      } else if (name.includes("Lat Pulldown") || name.includes("Lat Pull") || name.includes("Pullups") || name.includes("Pull-up") || name.includes("Chinup") || name.includes("Chin-up")) {
        if (name.includes("Pullups") || name.includes("Pull-up") || name.includes("Chinup") || name.includes("Chin-up")) {
          if (!hasPullup) {
            if (hasBands) adaptedName = "Resistance Band Lat Pulldowns";
            else if (hasDumbbells) adaptedName = "Dumbbell Pullovers";
            else adaptedName = "Bodyweight Superman Pulls";
          }
        } else {
          if (isHome || !equip.includes("gym machines")) {
            if (hasPullup) adaptedName = "Pullups";
            else if (hasBands) adaptedName = "Resistance Band Lat Pulldowns";
            else if (hasDumbbells) adaptedName = "Dumbbell Pullovers";
            else adaptedName = "Bodyweight Superman Pulls";
          }
        }
      } else if (name.includes("Cable") || name.includes("Smith Machine") || name.includes("Leg Press") || name.includes("Leg Extension") || name.includes("Lying Leg Curl")) {
        if (isHome || !equip.includes("gym machines")) {
          if (name.includes("Leg Press") || name.includes("Leg Extension")) {
            if (hasDumbbells) adaptedName = "Dumbbell Goblet Squats";
            else if (hasKettlebell) adaptedName = "Kettlebell Goblet Squats";
            else if (hasBarbell) adaptedName = "Barbell Back Squats";
            else adaptedName = "Bodyweight Squats";
          } else if (name.includes("Leg Curl")) {
            if (hasDumbbells) adaptedName = "Dumbbell Romanian Deadlifts";
            else if (hasBands) adaptedName = "Resistance Band Hamstring Curls";
            else if (hasBarbell) adaptedName = "Barbell Romanian Deadlifts";
            else adaptedName = "Single-Leg Bodyweight Romanian Deadlifts";
          } else if (name.includes("Cable Row") || name.includes("Cable Pulldown")) {
            if (hasDumbbells) adaptedName = "Dumbbell Bent-Over Rows";
            else if (hasBands) adaptedName = "Resistance Band Rows";
            else if (hasBarbell) adaptedName = "Barbell Bent-Over Rows";
            else adaptedName = "Doorframe Bodyweight Rows";
          } else if (name.includes("Cable Crossover") || name.includes("Cable Flyes")) {
            if (hasDumbbells) adaptedName = "Dumbbell Chest Flyes";
            else if (hasBands) adaptedName = "Resistance Band Chest Flyes";
            else adaptedName = "Bodyweight Pushups";
          } else {
            if (hasDumbbells) adaptedName = "Dumbbell Shoulder Press";
            else if (hasBarbell) adaptedName = "Barbell Shoulder Press";
            else adaptedName = "Bodyweight Pushups";
          }
        }
      }

      return { ...ex, name: adaptedName };
    }

    let days = {};

    if (goalsStr.includes('muscle') || goalsStr.includes('hypertrophy') || goalsStr.includes('gain')) {
      planType = 'Hypertrophy & Neuromuscular Power Program';
      planDescription = 'Optimized weekly progressive overload split designed to maximize myofibrillar protein synthesis and raw force development.';

      rawDays = {
        1: {
          name: "Day 1: Upper Body Push Force",
          exercises: [
            { name: "Dumbbell Flat Bench Press", sets: sets, reps: "8-12", target: "Pectoralis Major, Anterior Deltoids, Triceps", hold: "1s peak squeeze", image: placeholderImg },
            { name: "Standing Overhead Press", sets: sets - 1, reps: "8-10", target: "Anterior/Lateral Deltoids, Core Stabilizers", hold: "None", image: placeholderImg },
            { name: "Dumbbell Lateral Raises", sets: sets, reps: "12-15", target: "Lateral Deltoids", hold: "1s peak contraction", image: placeholderImg },
            { name: "Dumbbell Tricep Overhead Extensions", sets: sets - 1, reps: "12", target: "Triceps (Long Head)", hold: "None", image: placeholderImg },
            { name: "Incline Dumbbell Press", sets: sets, reps: "10-12", target: "Upper Pectorals", hold: "None", image: placeholderImg }
          ]
        },
        2: {
          name: "Day 2: Posterior Chain Pull Density",
          exercises: [
            { name: jointFriendly ? "Weighted Hip Thrusts" : "Dumbbell Romanian Deadlift", sets: sets, reps: "8-10", target: "Gluteus Maximus, Hamstrings, Erector Spinae", hold: "1s hold", image: placeholderImg },
            { name: "Dumbbell Bent-Over Row", sets: sets, reps: "10-12", target: "Latissimus Dorsi, Rhomboids, Trapezius", hold: "1s squeeze", image: placeholderImg },
            { name: "Wide Grip Lat Pulldown", sets: sets, reps: "10-12", target: "Latissimus Dorsi, Teres Major", hold: "1s contraction", image: placeholderImg },
            { name: "Seated Hammer Curls", sets: sets - 1, reps: "12", target: "Brachialis, Biceps Brachii", hold: "None", image: placeholderImg },
            { name: "Dumbbell Rear Delt Flyes", sets: sets, reps: "12-15", target: "Posterior Deltoids", hold: "None", image: placeholderImg }
          ]
        },
        3: {
          name: "Day 3: Lower Body Squat Volume",
          exercises: [
            { name: jointFriendly ? "Goblet Box Squats" : "Barbell Back Squats", sets: sets, reps: "8-10", target: "Quadriceps, Gluteus Maximus", hold: "None", image: placeholderImg },
            { name: "Bulgarian Split Squats", sets: sets - 1, reps: "10-12 per leg", target: "Quadriceps, Glute Medius", hold: "None", image: placeholderImg },
            { name: "Dumbbell Romanian Deadlift", sets: sets, reps: "10-12", target: "Hamstrings, Gluteus", hold: "None", image: placeholderImg },
            { name: "Standing Calf Raises", sets: sets, reps: "15", target: "Gastrocnemius, Soleus", hold: "2s stretch", image: placeholderImg },
            { name: "Dumbbell Walking Lunges", sets: sets, reps: "12 steps per leg", target: "Quads, Glutes", hold: "None", image: placeholderImg }
          ]
        },
        4: {
          name: "Day 4: Core & Active Regeneration",
          exercises: [
            { name: "Plank Hold", sets: 3, reps: "45s-60s", target: "Rectus Abdominis, Transverse Abdominis", hold: "Active hollow body", image: placeholderImg },
            { name: "Bird-Dog Extensions", sets: 3, reps: "12 per side", target: "Erector Spinae, Glutes, Deltoids", hold: "2s hold at peak", image: placeholderImg },
            { name: "Russian Twists", sets: 3, reps: "20 per side", target: "Obliques, Core", hold: "None", image: placeholderImg },
            { name: "Cobra Pose Stretch", sets: 2, reps: "30s", target: "Abdominals, Hip Flexors", hold: "Static stretch", image: placeholderImg },
            { name: "Superman Holds", sets: 3, reps: "30s", target: "Lower Back, Glutes", hold: "None", image: placeholderImg }
          ]
        },
        5: {
          name: "Day 5: Upper Body Hypertrophy Split",
          exercises: [
            { name: "Incline Dumbbell Press", sets: sets, reps: "10-12", target: "Upper Pectorals, Anterior Deltoids", hold: "None", image: placeholderImg },
            { name: "Wide Grip Lat Pulldown", sets: sets, reps: "10-12", target: "Latissimus Dorsi, Teres Major", hold: "1s contraction", image: placeholderImg },
            { name: "Dumbbell Flat Bench Press", sets: sets, reps: "8-12", target: "Pectoralis Major", hold: "None", image: placeholderImg },
            { name: "Dumbbell Tricep Overhead Extensions", sets: sets - 1, reps: "12", target: "Triceps (Long Head)", hold: "None", image: placeholderImg },
            { name: "Seated Hammer Curls", sets: sets - 1, reps: "12", target: "Brachialis, Biceps Brachii", hold: "None", image: placeholderImg }
          ]
        },
        6: {
          name: "Day 6: Metabolic Engine Synthesis",
          exercises: [
            { name: "Dumbbell Thrusters", sets: sets, reps: "12-15", target: "Full Body, Cardiovascular System", hold: "None", image: placeholderImg },
            { name: "Russian Kettlebell Swings", sets: sets, reps: "20", target: "Hamstrings, Glutes, Lower Back", hold: "None", image: placeholderImg },
            { name: "Hanging Knee Raises", sets: sets, reps: "15", target: "Rectus Abdominis", hold: "1s peak hold", image: placeholderImg },
            { name: "Mountain Climbers", sets: 3, reps: "45s", target: "Core, Cardio", hold: "None", image: placeholderImg },
            { name: "Pushups to Plank Shoulder Taps", sets: 3, reps: "10 reps", target: "Chest, Core", hold: "None", image: placeholderImg }
          ]
        },
        7: {
          name: "Day 7: Neuromuscular Recovery & Mobility",
          exercises: [
            { name: "Child's Pose Stretch", sets: 2, reps: "60s", target: "Lats, Lower Back, Shoulders", hold: "Static stretch", image: placeholderImg },
            { name: "Shoulder Pass-Throughs", sets: 3, reps: "10", target: "Rotator Cuff, Chest Mobility", hold: "None", image: placeholderImg },
            { name: "Dynamic Hip Opener Flow", sets: 2, reps: "10 per side", target: "Psoas, Adductors", hold: "Active stretching", image: placeholderImg },
            { name: "Hamstring Static Stretch", sets: 2, reps: "30s per leg", target: "Posterior leg chain", hold: "Static", image: placeholderImg },
            { name: "Cat-Cow Stretch", sets: 2, reps: "60s", target: "Spinal Mobility, Core Relief", hold: "Active breathing", image: placeholderImg }
          ]
        }
      };
    } else if (goalsStr.includes('loss') || goalsStr.includes('fat') || goalsStr.includes('weight')) {
      planType = 'High-Intensity Metabolic Synthesis Program';
      planDescription = 'High-density conditioning split using complex movement patterns to elevate excess post-exercise oxygen consumption (EPOC) and maximize daily energy expenditure.';

      rawDays = {
        1: {
          name: "Day 1: High Intensity Metabolic Blast",
          exercises: [
            { name: "Dumbbell Thrusters", sets: sets, reps: "12-15", target: "Full Body, Cardio", hold: "None", image: placeholderImg },
            { name: "Russian Kettlebell Swings", sets: sets, reps: "20", target: "Posterior Chain, Cardio", hold: "None", image: placeholderImg },
            { name: "Mountain Climbers", sets: 3, reps: "45s", target: "Core, Cardiovascular endurance", hold: "None", image: placeholderImg },
            { name: "Dumbbell Flat Bench Press", sets: sets, reps: "12", target: "Chest, Cardio", hold: "None", image: placeholderImg },
            { name: "Jumping Jacks", sets: 3, reps: "60s", target: "Cardio", hold: "None", image: placeholderImg }
          ]
        },
        2: {
          name: "Day 2: Posterior Chain & Core Strength",
          exercises: [
            { name: "Dumbbell Romanian Deadlift", sets: sets, reps: "12", target: "Glutes, Hamstrings", hold: "None", image: placeholderImg },
            { name: "Plank Shoulder Taps", sets: 3, reps: "15 per side", target: "Transverse Abdominis, Deltoids", hold: "None", image: placeholderImg },
            { name: "Bicycle Crunches", sets: 3, reps: "20 per side", target: "Rectus Abdominis, Obliques", hold: "None", image: placeholderImg },
            { name: "Dumbbell Walking Lunges", sets: sets, reps: "10 per leg", target: "Quads, Glutes", hold: "None", image: placeholderImg },
            { name: "Hollow Body Hold", sets: 3, reps: "30s", target: "Core", hold: "None", image: placeholderImg }
          ]
        },
        3: {
          name: "Day 3: Upper Body Conditioning",
          exercises: [
            { name: "Dumbbell Push Press", sets: sets, reps: "12", target: "Shoulders, Triceps", hold: "None", image: placeholderImg },
            { name: "Dumbbell Bent-Over Row", sets: sets, reps: "12", target: "Upper Back, Lats", hold: "None", image: placeholderImg },
            { name: jointFriendly ? "Wall Pushups" : "Incline Pushups", sets: sets, reps: "15", target: "Chest, Triceps", hold: "None", image: placeholderImg },
            { name: "Mountain Climbers", sets: 3, reps: "45s", target: "Cardio, Core", hold: "None", image: placeholderImg },
            { name: "Jumping Jacks", sets: 3, reps: "45s", target: "Cardio", hold: "None", image: placeholderImg }
          ]
        },
        4: {
          name: "Day 4: Active Recovery & Flow",
          exercises: [
            { name: "Cat-Cow Stretch", sets: 2, reps: "60s", target: "Spinal Mobility, Core Relief", hold: "Active breathing", image: placeholderImg },
            { name: "Child's Pose", sets: 2, reps: "60s", target: "Lats, Lower Back, Hips", hold: "Static stretch", image: placeholderImg },
            { name: "Bird-Dog Extensions", sets: 3, reps: "10 per side", target: "Lower Back, Glutes", hold: "2s hold", image: placeholderImg },
            { name: "Cobra Pose", sets: 2, reps: "45s", target: "Abdominals", hold: "None", image: placeholderImg },
            { name: "Shoulder Pass-Throughs", sets: 3, reps: "10", target: "Shoulder Mobility", hold: "None", image: placeholderImg }
          ]
        },
        5: {
          name: "Day 5: Lower Body Metabolic Burn",
          exercises: [
            { name: "Goblet Squats", sets: sets, reps: "15", target: "Quadriceps, Glutes", hold: "None", image: placeholderImg },
            { name: jointFriendly ? "Alternating Reverse Lunges" : "Alternating Lunge Jumps", sets: sets - 1, reps: "12 per leg", target: "Lower Body Explosiveness", hold: "None", image: placeholderImg },
            { name: "Glute Bridge Squeezes", sets: sets, reps: "20", target: "Gluteus Maximus", hold: "2s squeeze at peak", image: placeholderImg },
            { name: "Dumbbell Romanian Deadlift", sets: sets, reps: "12", target: "Hamstrings", hold: "None", image: placeholderImg },
            { name: "Standing Calf Raises", sets: sets, reps: "15", target: "Calves", hold: "None", image: placeholderImg }
          ]
        },
        6: {
          name: "Day 6: Cardio Engine Sprint",
          exercises: [
            { name: jointFriendly ? "Half-Burpees (No Jump)" : "Full Burpees", sets: sets, reps: "10-12", target: "Full Body conditioning", hold: "None", image: placeholderImg },
            { name: "Mountain Climbers", sets: 3, reps: "45s", target: "Core, Cardio", hold: "None", image: placeholderImg },
            { name: "High Knees Sprint", sets: 3, reps: "30s", target: "Aerobic Engine", hold: "None", image: placeholderImg },
            { name: "Russian Kettlebell Swings", sets: sets, reps: "20", target: "Posterior Chain", hold: "None", image: placeholderImg },
            { name: "Jumping Jacks", sets: 3, reps: "45s", target: "Cardio", hold: "None", image: placeholderImg }
          ]
        },
        7: {
          name: "Day 7: Active Recovery & Mobility",
          exercises: [
            { name: "Cobra Pose", sets: 2, reps: "45s", target: "Abdominals, Hip Flexors", hold: "Static stretch", image: placeholderImg },
            { name: "Dynamic Hip Openers", sets: 2, reps: "10 per leg", target: "Hip flexors, Hamstrings", hold: "Active stretching", image: placeholderImg },
            { name: "Hamstring Static Stretch", sets: 2, reps: "30s per leg", target: "Posterior leg chain", hold: "Static", image: placeholderImg },
            { name: "Child's Pose", sets: 2, reps: "60s", target: "Lats, Hips", hold: "None", image: placeholderImg },
            { name: "Cat-Cow Stretch", sets: 2, reps: "60s", target: "Spine", hold: "None", image: placeholderImg }
          ]
        }
      };
    } else if (goalsStr.includes('flexibility') || goalsStr.includes('mobility') || goalsStr.includes('stretch')) {
      planType = 'Flexibility, Mobility & Restorative Flow';
      planDescription = 'Dedicated movement routine focusing on joint range of motion, muscle decompression, spinal alignment, and dynamic recovery.';

      rawDays = {
        1: {
          name: "Day 1: Spinal Range & Decompression",
          exercises: [
            { name: "Cat-Cow Spinal Flow", sets: 2, reps: "60s slow flow", target: "Erector Spinae, Rhomboids, Spine", hold: "None", image: placeholderImg },
            { name: "Sphinx/Cobra Extension", sets: 2, reps: "45s static hold", target: "Rectus Abdominis, Hip Flexors", hold: "Static hold", image: placeholderImg },
            { name: "Thoracic Rotation Flow", sets: 2, reps: "10 per side", target: "Thoracic Spine, Shoulders", hold: "None", image: placeholderImg },
            { name: "Deep Child's Pose Decompression", sets: 2, reps: "60s static hold", target: "Lats, Lower Back", hold: "Static hold", image: placeholderImg },
            { name: "Seated Spinal Twist", sets: 2, reps: "30s per side", target: "Glutes, Obliques, Spine", hold: "None", image: placeholderImg }
          ]
        },
        2: {
          name: "Day 2: Hip Opening & Pelvic Alignment",
          exercises: [
            { name: "Deep Lizard Pose Stretch", sets: 2, reps: "45s per side", target: "Hip Flexors, Hamstrings, Groin", hold: "Static hold", image: placeholderImg },
            { name: "Restorative Pigeon Pose", sets: 2, reps: "45s per side", target: "Glutes, Piriformis, Hip Rotators", hold: "Static hold", image: placeholderImg },
            { name: "Butterfly Adductor Release", sets: 2, reps: "60s slow pulse", target: "Adductors, Groin", hold: "Dynamic", image: placeholderImg },
            { name: "Decompressing Happy Baby Pose", sets: 2, reps: "45s hold", target: "Lower Back, Glutes, Hamstrings", hold: "None", image: placeholderImg },
            { name: "Frog Pose Hip Opener", sets: 2, reps: "30s hold", target: "Groin, Hips", hold: "None", image: placeholderImg }
          ]
        },
        3: {
          name: "Day 3: Shoulder, Chest & Upper Body Opener",
          exercises: [
            { name: "Chest & Bicep Wall Stretch", sets: 2, reps: "30s per side", target: "Pectoralis Major, Biceps", hold: "Static", image: placeholderImg },
            { name: "Shoulder Pass-Throughs (with towel/band)", sets: 2, reps: "12 slow reps", target: "Rotator Cuff, Deltoids", hold: "Dynamic", image: placeholderImg },
            { name: "Puppy Pose Shoulder Opener", sets: 2, reps: "60s hold", target: "Shoulders, Upper Back, Lats", hold: "Static", image: placeholderImg },
            { name: "Behind-the-Back Shoulder Clasp", sets: 2, reps: "30s per side", target: "Shoulders, Rotators", hold: "None", image: placeholderImg },
            { name: "Neck & Trapezius Releases", sets: 2, reps: "30s per side", target: "Upper Trapezius, Scalenes", hold: "None", image: placeholderImg }
          ]
        },
        4: {
          name: "Day 4: Core Stability & Alignment",
          exercises: [
            { name: "Bird-Dog Extensions", sets: 2, reps: "12 slow reps", target: "Erector Spinae, Gluteus, Core", hold: "2s hold", image: placeholderImg },
            { name: "Deadbug Core Alignment", sets: 2, reps: "12 slow reps", target: "Transverse Abdominis, Core", hold: "None", image: placeholderImg },
            { name: "Plank Hold", sets: 2, reps: "45s hold", target: "Rectus Abdominis, Shoulder Stabilizers", hold: "None", image: placeholderImg },
            { name: "Glute Bridge Squeezes", sets: 2, reps: "15 slow reps", target: "Gluteus Maximus, Hamstrings", hold: "1s squeeze", image: placeholderImg },
            { name: "Sphinx/Cobra Extension", sets: 2, reps: "30s static", target: "Abdominals", hold: "None", image: placeholderImg }
          ]
        },
        5: {
          name: "Day 5: Full-Body Dynamic Yoga Flow",
          exercises: [
            { name: "Downward Facing Dog", sets: 2, reps: "45s hold", target: "Posterior Chain, Shoulders, Calves", hold: "Static", image: placeholderImg },
            { name: "Low Lunge Crescent Twist", sets: 2, reps: "8 per side", target: "Psoas, Thoracic Spine, Quads", hold: "None", image: placeholderImg },
            { name: "Warrior II Grounded Alignment", sets: 2, reps: "30s per side", target: "Glutes, Adductors, Shoulders", hold: "None", image: placeholderImg },
            { name: "Hamstring Triangle Pose", sets: 2, reps: "30s per side", target: "Hamstrings, Obliques, Shoulders", hold: "None", image: placeholderImg },
            { name: "Tree Pose Balance Flow", sets: 2, reps: "30s per leg", target: "Ankle Stabilizers, Core, Balance", hold: "None", image: placeholderImg }
          ]
        },
        6: {
          name: "Day 6: Posterior Chain & Hamstring Release",
          exercises: [
            { name: "Seated Forward Fold", sets: 2, reps: "60s hold", target: "Hamstrings, Calves, Lower Back", hold: "Static", image: placeholderImg },
            { name: "Ragdoll Standing Forward Fold", sets: 2, reps: "60s loose hold", target: "Spine, Hamstrings, Hips", hold: "Static", image: placeholderImg },
            { name: "Couch Stretches for Quads", sets: 2, reps: "45s per leg", target: "Quadriceps, Hip flexors", hold: "Static", image: placeholderImg },
            { name: "Lying Figure-4 Glute Stretch", sets: 2, reps: "45s per leg", target: "Gluteus Maximus, Piriformis", hold: "Static", image: placeholderImg },
            { name: "Calf Wall Flexion Stretch", sets: 2, reps: "30s per leg", target: "Gastrocnemius, Soleus", hold: "None", image: placeholderImg }
          ]
        },
        7: {
          name: "Day 7: Restorative Release & Savasana",
          exercises: [
            { name: "Deep Child's Pose Decompression", sets: 1, reps: "90s hold", target: "Full Body Relaxation", hold: "Static", image: placeholderImg },
            { name: "Sphinx Pose Neck Rolls", sets: 2, reps: "45s slow rolls", target: "Cervical Spine, Trapezius", hold: "Dynamic", image: placeholderImg },
            { name: "Supine Knees-to-Chest Hug", sets: 1, reps: "60s hold", target: "Lower Back, Glutes", hold: "Static", image: placeholderImg },
            { name: "Corpse Pose Savasana Breathing", sets: 1, reps: "5 mins breathing", target: "CNS Recovery, Autonomic nervous system", hold: "None", image: placeholderImg },
            { name: "Seated Head-to-Knee Side Bend", sets: 2, reps: "30s per side", target: "Lats, QL, Hamstrings", hold: "None", image: placeholderImg }
          ]
        }
      };
    } else {
      planType = 'Aerobic & Anaerobic Conditioning Program';
      planDescription = 'High-repetition split designed to increase mitochondrial density, lactic acid clearance rate, and active sports performance capacity.';

      rawDays = {
        1: {
          name: "Day 1: Upper Body Endurance & Stabilizers",
          exercises: [
            { name: jointFriendly ? "Incline Wall Pushups" : "Pushups (High Rep)", sets: sets, reps: "15-20", target: "Chest, Shoulders, Triceps", hold: "None", image: placeholderImg },
            { name: "Dumbbell Bent-Over Row", sets: sets, reps: "15", target: "Latissimus Dorsi, Back", hold: "None", image: placeholderImg },
            { name: "Plank-to-Pushup Flow", sets: sets - 1, reps: "10", target: "Shoulders, Chest, Core endurance", hold: "None", image: placeholderImg },
            { name: "Dumbbell Lateral Raises", sets: sets, reps: "15", target: "Shoulders", hold: "None", image: placeholderImg },
            { name: "Jumping Jacks", sets: 3, reps: "60s", target: "Cardio", hold: "None", image: placeholderImg }
          ]
        },
        2: {
          name: "Day 2: Lower Body Unilateral Stability",
          exercises: [
            { name: "Bulgarian Split Squats", sets: sets, reps: "12-15 per leg", target: "Quadriceps, Glutes, Unilateral Balance", hold: "None", image: placeholderImg },
            { name: "Dumbbell Step-Ups", sets: sets - 1, reps: "12 per leg", target: "Quads, Hip Flexors, Glutes", hold: "None", image: placeholderImg },
            { name: "Single Leg Glute Bridges", sets: sets, reps: "12 per side", target: "Hamstrings, Glute Medius", hold: "1s squeeze", image: placeholderImg },
            { name: "Standing Calf Raises", sets: sets, reps: "15", target: "Calves", hold: "None", image: placeholderImg },
            { name: "Dumbbell Walking Lunges", sets: sets, reps: "12 per leg", target: "Quads, Hips", hold: "None", image: placeholderImg }
          ]
        },
        3: {
          name: "Day 3: Back & Core Stamina",
          exercises: [
            { name: "Wide Grip Lat Pulldown", sets: sets, reps: "12-15", target: "Latissimus Dorsi", hold: "None", image: placeholderImg },
            { name: "Hanging Knee Raises", sets: sets, reps: "15", target: "Rectus Abdominis", hold: "1s peak hold", image: placeholderImg },
            { name: "Russian Twists", sets: 3, reps: "20 per side", target: "Obliques, Core", hold: "None", image: placeholderImg },
            { name: "Plank Hold", sets: 3, reps: "60s", target: "Core", hold: "None", image: placeholderImg },
            { name: "Superman Holds", sets: 3, reps: "45s", target: "Back", hold: "None", image: placeholderImg }
          ]
        },
        4: {
          name: "Day 4: Active Recovery / Flow",
          exercises: [
            { name: "Cat-Cow Stretch", sets: 2, reps: "60s", target: "Spinal Mobility, Core Relief", hold: "Active breathing", image: placeholderImg },
            { name: "Child's Pose", sets: 2, reps: "60s", target: "Lats, Lower Back, Hips", hold: "Static stretch", image: placeholderImg },
            { name: "Bird-Dog Extensions", sets: 3, reps: "10 per side", target: "Lower Back, Glutes", hold: "2s hold", image: placeholderImg },
            { name: "Sphinx/Cobra Extension", sets: 2, reps: "45s", target: "Abdominals", hold: "None", image: placeholderImg },
            { name: "Shoulder Pass-Throughs (with towel/band)", sets: 3, reps: "10", target: "Shoulder Mobility", hold: "None", image: placeholderImg }
          ]
        },
        5: {
          name: "Day 5: Lower Body Quadriceps Endurance",
          exercises: [
            { name: "Goblet Squats", sets: sets, reps: "15", target: "Quadriceps, Glutes", hold: "None", image: placeholderImg },
            { name: "Walking Lunges", sets: sets - 1, reps: "15 per leg", target: "Quads, Hamstrings, Balance", hold: "None", image: placeholderImg },
            { name: "Bodyweight Squats (High Rep)", sets: 3, reps: "25", target: "Muscular Endurance", hold: "None", image: placeholderImg },
            { name: "Glute Bridge Squeezes", sets: sets, reps: "15", target: "Glutes", hold: "None", image: placeholderImg },
            { name: "Standing Calf Raises", sets: sets, reps: "15", target: "Calves", hold: "None", image: placeholderImg }
          ]
        },
        6: {
          name: "Day 6: Full Body Conditioning",
          exercises: [
            { name: "Russian Kettlebell Swings", sets: sets, reps: "20", target: "Posterior Chain, Cardio", hold: "None", image: placeholderImg },
            { name: "Dumbbell Thrusters", sets: sets - 1, reps: "12", target: "Full Body, Cardio", hold: "None", image: placeholderImg },
            { name: "Mountain Climbers", sets: 3, reps: "45s", target: "Core, Cardio", hold: "None", image: placeholderImg },
            { name: "Jumping Jacks", sets: 3, reps: "60s", target: "Cardio", hold: "None", image: placeholderImg },
            { name: "Plank Jacks", sets: 3, reps: "45s", target: "Core", hold: "None", image: placeholderImg }
          ]
        },
        7: {
          name: "Day 7: Active Recovery / Joint Mobility",
          exercises: [
            { name: "Shoulder Mobility Drills", sets: 2, reps: "12", target: "Shoulder Rotators", hold: "None", image: placeholderImg },
            { name: "Foam Rolling Flow", sets: 1, reps: "5 mins", target: "Myofascial Release", hold: "None", image: placeholderImg },
            { name: "Child's Pose Stretch", sets: 2, reps: "60s", target: "Lats, Lower Back", hold: "Static", image: placeholderImg },
            { name: "Cat-Cow Stretch", sets: 2, reps: "60s", target: "Spine", hold: "None", image: placeholderImg },
            { name: "Sphinx/Cobra Extension", sets: 2, reps: "30s", target: "Abs", hold: "None", image: placeholderImg }
          ]
        }
      };
    }

    // Determine workout duration constraints
    const durationMin = proto.duration ? Number(proto.duration) : 30;
    let numExercises = 3;
    if (durationMin <= 15) numExercises = 2;
    else if (durationMin <= 30) numExercises = 3;
    else if (durationMin <= 45) numExercises = 4;
    else numExercises = 5;

    days = {};
    for (let dayNum = 1; dayNum <= 7; dayNum++) {
      const dayData = rawDays[dayNum];
      if (dayData) {
        // Adapt exercises based on equipment/location
        const adaptedExs = dayData.exercises.map(ex => adaptExercise(ex));
        // Slice exercises depending on duration and adjust sets
        const finalExs = adaptedExs.slice(0, numExercises).map(ex => {
          let adjustedSets = sets;
          if (durationMin <= 15) {
            adjustedSets = 2; // Keep sets lower for 15-minute quick workouts
          }
          return {
            ...ex,
            sets: adjustedSets
          };
        });
        days[dayNum] = {
          name: dayData.name,
          exercises: finalExs
        };
      }
    }

    const plan = {
      startDate: new Date().toISOString(),
      planType,
      planDescription,
      restSecs,
      sets,
      volumeTag,
      jointFriendly,
      days
    };

    user.workoutPlan = plan;
    await user.save();

    res.status(200).json({ plan });
  } catch (error) {
    console.error('Generate workout plan error:', error);
    res.status(500).json({ error: 'Failed to generate workout plan.' });
  }
});

// 5. Save Workout Session Route
app.post('/api/workouts', async (req, res) => {
  try {
    const { email, workoutName, duration, steps, distance, calories } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'User email is required to save workout.' });
    }
    const workout = new Workout({
      email: email.toLowerCase(),
      workoutName: workoutName || 'Custom Session',
      duration: Number(duration),
      steps: Number(steps),
      distance: Number(distance),
      calories: calories ? Number(calories) : undefined
    });
    await workout.save();
    res.status(201).json({ message: 'Workout saved successfully.', workout });
  } catch (error) {
    console.error('Save workout error:', error);
    res.status(500).json({ error: 'Failed to save workout.' });
  }
});

// 6. Get Workouts History Route
app.get('/api/workouts', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: 'User email is required.' });
    }
    const workouts = await Workout.find({ email: email.toLowerCase() }).sort({ date: -1 });
    res.status(200).json(workouts);
  } catch (error) {
    console.error('Get workouts error:', error);
    res.status(500).json({ error: 'Failed to fetch workouts.' });
  }
});


// ==========================================
// AI DIET PLANNER ROUTES & RECIPE DATABASE
// ==========================================

// Predefined recipes catalog categorized by type, meal, allergens, and budget
const RECIPES_DATABASE = [
  // BREAKFASTS
  {
    name: "Oatmeal with Banana & Peanut Butter",
    type: "vegetarian",
    calories: 450, protein: 15, carbs: 65, fat: 18,
    allergens: ["nuts", "peanuts"],
    budgetTier: "low",
    mealType: "breakfast",
    ingredients: ["1 cup oats", "1 medium banana", "2 tbsp peanut butter", "1 cup water"]
  },
  {
    name: "Oatmeal with Banana & Flaxseeds",
    type: "vegan",
    calories: 420, protein: 12, carbs: 68, fat: 12,
    allergens: [],
    budgetTier: "low",
    mealType: "breakfast",
    ingredients: ["1 cup oats", "1 medium banana", "2 tbsp ground flaxseeds", "1 cup water"]
  },
  {
    name: "Scrambled Eggs with Toast & Butter",
    type: "non-vegetarian",
    calories: 480, protein: 22, carbs: 32, fat: 26,
    allergens: ["eggs", "dairy", "gluten"],
    budgetTier: "low",
    mealType: "breakfast",
    ingredients: ["3 whole eggs", "2 slices whole wheat toast", "1 tbsp butter"]
  },
  {
    name: "Greek Yogurt Parfait with Honey & Berries",
    type: "vegetarian",
    calories: 460, protein: 25, carbs: 55, fat: 12,
    allergens: ["dairy"],
    budgetTier: "mid",
    mealType: "breakfast",
    ingredients: ["1 cup low fat greek yogurt", "1 tbsp honey", "0.5 cup organic berries", "2 tbsp granola"]
  },
  {
    name: "Avocado Toast on Sourdough with Chia Seeds",
    type: "vegan",
    calories: 410, protein: 10, carbs: 52, fat: 20,
    allergens: ["gluten"],
    budgetTier: "mid",
    mealType: "breakfast",
    ingredients: ["1 slice sourdough bread", "0.5 ripe avocado", "1 tbsp chia seeds", "lemon juice"]
  },
  {
    name: "Turkey Bacon & Egg White Wrap",
    type: "non-vegetarian",
    calories: 430, protein: 28, carbs: 35, fat: 14,
    allergens: ["eggs", "gluten"],
    budgetTier: "mid",
    mealType: "breakfast",
    ingredients: ["4 egg whites", "2 slices turkey bacon", "1 whole wheat tortilla wrap"]
  },
  {
    name: "Acai Bowl with Organic Hemp Hearts & Almond Butter",
    type: "vegetarian",
    calories: 520, protein: 14, carbs: 70, fat: 24,
    allergens: ["nuts"],
    budgetTier: "high",
    mealType: "breakfast",
    ingredients: ["1 organic acai pack", "1 cup almond milk", "1 tbsp organic almond butter", "2 tbsp hemp seeds"]
  },
  {
    name: "Smoked Tofu & Avocado Scramble on Seed Bread",
    type: "vegan",
    calories: 490, protein: 22, carbs: 38, fat: 28,
    allergens: ["soy"],
    budgetTier: "high",
    mealType: "breakfast",
    ingredients: ["150g firm tofu", "0.5 avocado (cubed)", "2 slices organic seed bread", "turmeric seasoning"]
  },
  {
    name: "Smoked Salmon & Cream Cheese Bagel",
    type: "non-vegetarian",
    calories: 580, protein: 32, carbs: 58, fat: 22,
    allergens: ["fish", "dairy", "gluten"],
    budgetTier: "high",
    mealType: "breakfast",
    ingredients: ["100g smoked salmon", "2 tbsp cream cheese", "1 whole wheat bagel"]
  },

  // LUNCHES
  {
    name: "Black Bean & Rice Bowl with Melted Cheddar",
    type: "vegetarian",
    calories: 620, protein: 24, carbs: 90, fat: 16,
    allergens: ["dairy"],
    budgetTier: "low",
    mealType: "lunch",
    ingredients: ["1 cup black beans", "1.5 cups jasmine rice", "30g cheddar cheese", "salsa"]
  },
  {
    name: "Spicy Chickpea & Rice Bowl with Veggies",
    type: "vegan",
    calories: 580, protein: 18, carbs: 94, fat: 12,
    allergens: ["soy"],
    budgetTier: "low",
    mealType: "lunch",
    ingredients: ["1 cup chickpeas", "1.5 cups white rice", "1 cup frozen mixed vegetables", "soy sauce"]
  },
  {
    name: "Canned Tuna Salad Sandwich",
    type: "non-vegetarian",
    calories: 590, protein: 38, carbs: 48, fat: 18,
    allergens: ["fish", "eggs", "gluten"],
    budgetTier: "low",
    mealType: "lunch",
    ingredients: ["1 can chunk light tuna", "1 tbsp mayonnaise", "2 slices whole wheat bread", "lettuce"]
  },
  {
    name: "Mediterranean Quinoa Bowl with Feta & Olives",
    type: "vegetarian",
    calories: 650, protein: 20, carbs: 75, fat: 25,
    allergens: ["dairy"],
    budgetTier: "mid",
    mealType: "lunch",
    ingredients: ["1 cup cooked quinoa", "50g Greek feta cheese", "6 kalamata olives", "diced cucumber & tomato"]
  },
  {
    name: "Lentil Soup with Sweet Potatoes & Spinach",
    type: "vegan",
    calories: 520, protein: 22, carbs: 85, fat: 6,
    allergens: [],
    budgetTier: "mid",
    mealType: "lunch",
    ingredients: ["1 cup brown lentils", "1 medium sweet potato", "2 cups fresh baby spinach", "vegetable broth"]
  },
  {
    name: "Grilled Chicken & Jasmine Rice with Broccoli",
    type: "non-vegetarian",
    calories: 680, protein: 46, carbs: 78, fat: 12,
    allergens: [],
    budgetTier: "mid",
    mealType: "lunch",
    ingredients: ["150g lean chicken breast", "1.5 cups cooked jasmine rice", "1 cup steamed broccoli", "1 tbsp olive oil"]
  },
  {
    name: "Arugula Salad with Goat Cheese, Walnuts & Figs",
    type: "vegetarian",
    calories: 690, protein: 15, carbs: 58, fat: 42,
    allergens: ["dairy", "nuts"],
    budgetTier: "high",
    mealType: "lunch",
    ingredients: ["3 cups fresh arugula", "60g soft goat cheese", "0.25 cup chopped walnuts", "4 dry figs"]
  },
  {
    name: "Quinoa Pilaf with Avocado & Grilled Tempeh",
    type: "vegan",
    calories: 680, protein: 26, carbs: 82, fat: 24,
    allergens: ["soy"],
    budgetTier: "high",
    mealType: "lunch",
    ingredients: ["1 cup cooked quinoa", "0.5 fresh avocado", "100g organic tempeh", "saffron broth"]
  },
  {
    name: "Air-fried Steak Bites with Potatoes & Asparagus",
    type: "non-vegetarian",
    calories: 820, protein: 55, carbs: 45, fat: 44,
    allergens: ["dairy"],
    budgetTier: "high",
    mealType: "lunch",
    ingredients: ["200g grass-fed steak", "200g baby potatoes", "1 bunch asparagus", "1.5 tbsp garlic butter"]
  },

  // DINNERS
  {
    name: "Cheesy Lentil Pasta with Marinara Sauce",
    type: "vegetarian",
    calories: 600, protein: 32, carbs: 85, fat: 12,
    allergens: ["dairy", "gluten"],
    budgetTier: "low",
    mealType: "dinner",
    ingredients: ["100g red lentil pasta", "1 cup marinara sauce", "2 tbsp shredded parmesan"]
  },
  {
    name: "Tofu & Mixed Veggie Stir-Fry",
    type: "vegan",
    calories: 550, protein: 24, carbs: 72, fat: 18,
    allergens: ["soy"],
    budgetTier: "low",
    mealType: "dinner",
    ingredients: ["150g firm tofu (cubed)", "2 cups fresh stir-fry veggie mix", "1 tbsp vegetable oil", "jasmine rice"]
  },
  {
    name: "Baked Chicken Thighs with White Rice & Green Beans",
    type: "non-vegetarian",
    calories: 650, protein: 38, carbs: 62, fat: 26,
    allergens: [],
    budgetTier: "low",
    mealType: "dinner",
    ingredients: ["2 bone-in chicken thighs", "1 cup cooked white rice", "100g steamed green beans"]
  },
  {
    name: "Stuffed Bell Peppers with Brown Rice & Mozzarella",
    type: "vegetarian",
    calories: 640, protein: 22, carbs: 78, fat: 24,
    allergens: ["dairy"],
    budgetTier: "mid",
    mealType: "dinner",
    ingredients: ["2 large bell peppers", "1 cup brown rice", "0.5 cup black beans", "60g shredded mozzarella"]
  },
  {
    name: "Chickpea Coconut Curry with Basmati Rice",
    type: "vegan",
    calories: 680, protein: 18, carbs: 92, fat: 26,
    allergens: [],
    budgetTier: "mid",
    mealType: "dinner",
    ingredients: ["1 cup boiled chickpeas", "0.5 cup light coconut milk", "curry spices", "1 cup basmati rice"]
  },
  {
    name: "Pan-Seared Salmon with Quinoa & Asparagus",
    type: "non-vegetarian",
    calories: 710, protein: 42, carbs: 54, fat: 32,
    allergens: ["fish"],
    budgetTier: "mid",
    mealType: "dinner",
    ingredients: ["150g fresh salmon fillet", "1 cup cooked quinoa", "100g pan-grilled asparagus", "lemon juice"]
  },
  {
    name: "Truffle Mushroom Risotto with Parmesan & Pine Nuts",
    type: "vegetarian",
    calories: 780, protein: 18, carbs: 96, fat: 34,
    allergens: ["dairy", "nuts"],
    budgetTier: "high",
    mealType: "dinner",
    ingredients: ["1 cup arborio rice", "150g portobello mushrooms", "2 tbsp parmesan cheese", "1 tbsp truffle oil", "1 tbsp roasted pine nuts"]
  },
  {
    name: "Portobello Steak with Mashed Cauliflower & Avocado",
    type: "vegan",
    calories: 590, protein: 15, carbs: 42, fat: 36,
    allergens: [],
    budgetTier: "high",
    mealType: "dinner",
    ingredients: ["2 large portobello mushroom caps", "300g cauliflower mash", "1 whole avocado (sliced)", "2 tbsp olive oil"]
  },
  {
    name: "Ribeye Steak with Sweet Potato Mash & Spinach",
    type: "non-vegetarian",
    calories: 920, protein: 58, carbs: 48, fat: 54,
    allergens: [],
    budgetTier: "high",
    mealType: "dinner",
    ingredients: ["250g ribeye steak", "1 large sweet potato", "2 cups baby spinach", "1 tbsp butter"]
  },

  // SNACKS
  {
    name: "Cottage Cheese with Cucumber",
    type: "vegetarian",
    calories: 180, protein: 18, carbs: 8, fat: 6,
    allergens: ["dairy"],
    budgetTier: "low",
    mealType: "snack",
    ingredients: ["1 cup cottage cheese", "1 sliced cucumber", "black pepper"]
  },
  {
    name: "Apple Slices with Peanut Butter",
    type: "vegan",
    calories: 220, protein: 6, carbs: 28, fat: 12,
    allergens: ["nuts", "peanuts"],
    budgetTier: "low",
    mealType: "snack",
    ingredients: ["1 medium apple", "1.5 tbsp peanut butter"]
  },
  {
    name: "Hard-Boiled Eggs",
    type: "non-vegetarian",
    calories: 140, protein: 12, carbs: 1, fat: 10,
    allergens: ["eggs"],
    budgetTier: "low",
    mealType: "snack",
    ingredients: ["2 large eggs"]
  },
  {
    name: "Mixed Dry Roasted Almonds & Raisins",
    type: "vegetarian",
    calories: 240, protein: 8, carbs: 22, fat: 16,
    allergens: ["nuts"],
    budgetTier: "mid",
    mealType: "snack",
    ingredients: ["30g roasted almonds", "30g organic dark raisins"]
  },
  {
    name: "Hummus with Carrots & Celery",
    type: "vegan",
    calories: 190, protein: 5, carbs: 18, fat: 11,
    allergens: [],
    budgetTier: "mid",
    mealType: "snack",
    ingredients: ["3 tbsp roasted garlic hummus", "2 carrots (sliced)", "2 celery stalks"]
  },
  {
    name: "Turkey Jerky",
    type: "non-vegetarian",
    calories: 160, protein: 22, carbs: 6, fat: 4,
    allergens: [],
    budgetTier: "mid",
    mealType: "snack",
    ingredients: ["50g lean turkey jerky"]
  },
  {
    name: "Organic Dark Chocolate & Strawberries",
    type: "vegetarian",
    calories: 290, protein: 4, carbs: 32, fat: 18,
    allergens: ["dairy"],
    budgetTier: "high",
    mealType: "snack",
    ingredients: ["40g organic 85% dark chocolate", "100g fresh strawberries"]
  },
  {
    name: "Roasted Pumpkin Seeds & Freeze-Dried Mangoes",
    type: "vegan",
    calories: 250, protein: 9, carbs: 26, fat: 14,
    allergens: [],
    budgetTier: "high",
    mealType: "snack",
    ingredients: ["30g shell-less pumpkin seeds", "25g freeze-dried mango chips"]
  },
  {
    name: "Prosciutto & Goat Cheese Roll",
    type: "non-vegetarian",
    calories: 280, protein: 18, carbs: 4, fat: 22,
    allergens: ["dairy"],
    budgetTier: "high",
    mealType: "snack",
    ingredients: ["3 slices prosciutto", "40g soft goat cheese"]
  }
];

// Helper to filter and adapt a recipe based on dietary preferences, budget, and allergies
function findAndFilterRecipe(mealType, dietaryType, budget, allergies) {
  let candidates = RECIPES_DATABASE.filter(r => r.mealType === mealType);

  if (dietaryType === 'vegan') {
    candidates = candidates.filter(r => r.type === 'vegan');
  } else if (dietaryType === 'vegetarian') {
    candidates = candidates.filter(r => r.type === 'vegan' || r.type === 'vegetarian');
  }

  if (allergies && allergies.length > 0) {
    const allergyLower = allergies.map(a => a.toLowerCase().trim());
    candidates = candidates.filter(r => {
      const hasAllergy = r.allergens.some(allg => allergyLower.includes(allg.toLowerCase()));
      return !hasAllergy;
    });
  }

  let budgetMatches = candidates.filter(r => r.budgetTier === budget);
  if (budgetMatches.length === 0) {
    budgetMatches = candidates;
  }

  if (budgetMatches.length === 0) {
    const ultimateFallback = RECIPES_DATABASE.find(r => r.mealType === mealType);
    return JSON.parse(JSON.stringify(ultimateFallback));
  }

  const selected = budgetMatches[Math.floor(Math.random() * budgetMatches.length)];
  const cloned = JSON.parse(JSON.stringify(selected));

  if (allergies && allergies.length > 0) {
    const allergyLower = allergies.map(a => a.toLowerCase().trim());
    if (allergyLower.includes('gluten')) {
      cloned.name = cloned.name.replace("Toast", "Gluten-Free Toast").replace("Bread", "Gluten-Free Bread").replace("Bagel", "Gluten-Free Bagel").replace("Pasta", "Gluten-Free Pasta");
      cloned.ingredients = cloned.ingredients.map(ing =>
        ing.replace("bread", "gluten-free bread").replace("toast", "gluten-free toast").replace("bagel", "gluten-free bagel").replace("pasta", "gluten-free pasta")
      );
    }
    if (allergyLower.includes('dairy') || allergyLower.includes('milk')) {
      cloned.name = cloned.name.replace("Greek Yogurt", "Coconut Yogurt").replace("Cheddar", "Vegan Cheese").replace("Cheese", "Vegan Cheese").replace("Butter", "Olive Oil");
      cloned.ingredients = cloned.ingredients.map(ing =>
        ing.replace("greek yogurt", "coconut yogurt").replace("cheddar cheese", "vegan cheddar").replace("cheese", "vegan cheese").replace("butter", "olive oil")
      );
    }
    if (allergyLower.includes('nuts') || allergyLower.includes('peanuts')) {
      cloned.name = cloned.name.replace("Peanut Butter", "Sunflower Seed Butter").replace("Almond Butter", "Tahini").replace("Walnuts", "Pumpkin Seeds").replace("Almonds", "Soy Nuts").replace("Pine Nuts", "Sunflower Seeds");
      cloned.ingredients = cloned.ingredients.map(ing =>
        ing.replace("peanut butter", "sunflower seed butter").replace("almond butter", "tahini").replace("walnuts", "pumpkin seeds").replace("almonds", "soy nuts").replace("pine nuts", "sunflower seeds")
      );
    }
    if (allergyLower.includes('soy')) {
      cloned.name = cloned.name.replace("Tofu", "Chickpeas").replace("Tempeh", "Lentils").replace("Soy Sauce", "Coconut Aminos").replace("soy sauce", "coconut aminos");
      cloned.ingredients = cloned.ingredients.map(ing =>
        ing.toLowerCase().includes("soy sauce") ? ing.replace(/soy sauce/gi, "coconut aminos") :
          ing.toLowerCase().includes("tofu") ? ing.replace(/tofu/gi, "chickpeas") :
            ing.toLowerCase().includes("tempeh") ? ing.replace(/tempeh/gi, "lentils") : ing
      );
    }
  }

  return cloned;
}

// 4e. Save Diet Profile Telemetry
app.post('/api/user/diet-profile', async (req, res) => {
  try {
    const { email, dietaryType, allergies, budget, dailyCalories } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'User email is required.' });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    user.dietProfile = {
      dietaryType: dietaryType || 'non-vegetarian',
      allergies: Array.isArray(allergies) ? allergies : [],
      budget: budget || 'mid',
      dailyCalories: Number(dailyCalories) || 2000
    };

    await user.save();
    res.status(200).json({ message: "Diet profile updated successfully.", dietProfile: user.dietProfile });
  } catch (error) {
    console.error("Save diet profile error:", error);
    res.status(500).json({ error: "Failed to save diet profile." });
  }
});

// 4f. Get Diet Profile
app.get('/api/user/diet-profile', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: 'User email is required.' });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.status(200).json({ dietProfile: user.dietProfile || {} });
  } catch (error) {
    console.error("Get diet profile error:", error);
    res.status(500).json({ error: "Failed to fetch diet profile." });
  }
});

// 4g. Generate & Save AI Diet Plan
app.post('/api/user/diet-plan', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'User email is required.' });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const dProfile = user.dietProfile || {};
    const weight = user.protocol?.weight || 70;
    const targetKcal = dProfile.dailyCalories || 2000;
    const dietaryType = dProfile.dietaryType || 'non-vegetarian';
    const budget = dProfile.budget || 'mid';
    const allergies = dProfile.allergies || [];

    const calculatedWater = (weight * 35) / 1000;
    const waterGoal = Math.min(5.0, Math.max(2.0, Number(calculatedWater.toFixed(1))));

    const scaleMeal = (meal, targetMealKcal) => {
      const baseScale = targetMealKcal / meal.calories;
      return {
        name: meal.name,
        calories: Math.round(meal.calories * baseScale),
        protein: Math.round(meal.protein * baseScale),
        carbs: Math.round(meal.carbs * baseScale),
        fat: Math.round(meal.fat * baseScale),
        ingredients: meal.ingredients
      };
    };

    const compileDaysPlan = () => {
      const bMealRaw = findAndFilterRecipe("breakfast", dietaryType, budget, allergies);
      const lMealRaw = findAndFilterRecipe("lunch", dietaryType, budget, allergies);
      const dMealRaw = findAndFilterRecipe("dinner", dietaryType, budget, allergies);
      const sMealRaw = findAndFilterRecipe("snack", dietaryType, budget, allergies);

      const breakfast = scaleMeal(bMealRaw, targetKcal * 0.25);
      const lunch = scaleMeal(lMealRaw, targetKcal * 0.35);
      const dinner = scaleMeal(dMealRaw, targetKcal * 0.30);
      const snack = scaleMeal(sMealRaw, targetKcal * 0.10);

      return { breakfast, lunch, dinner, snack };
    };

    const dailyMeals = compileDaysPlan();

    const weeklyMeals = {};
    for (let dayNum = 1; dayNum <= 7; dayNum++) {
      weeklyMeals[dayNum] = compileDaysPlan();
    }

    const shoppingSet = new Set();
    const addShoppingIngredients = (mealsObj) => {
      Object.keys(mealsObj).forEach(key => {
        mealsObj[key].ingredients.forEach(ing => {
          const cleanedText = ing.replace(/^\d+(\.\d+)?\s+(\w+)\s+(of\s+)?/i, '').trim();
          shoppingSet.add(cleanedText.charAt(0).toUpperCase() + cleanedText.slice(1));
        });
      });
    };

    for (let dNum = 1; dNum <= 7; dNum++) {
      addShoppingIngredients(weeklyMeals[dNum]);
    }
    const shoppingList = Array.from(shoppingSet);

    const plan = {
      generatedAt: new Date().toISOString(),
      waterGoal,
      dailyMeals,
      weeklyMeals,
      shoppingList
    };

    user.dietPlan = plan;
    await user.save();

    res.status(200).json({ plan });
  } catch (error) {
    console.error("Generate diet plan error:", error);
    res.status(500).json({ error: "Failed to generate AI diet plan." });
  }
});

// 4h. Get Saved Diet Plan
app.get('/api/user/diet-plan', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: 'User email is required.' });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.status(200).json({ plan: user.dietPlan || null });
  } catch (error) {
    console.error("Get diet plan error:", error);
    res.status(500).json({ error: "Failed to fetch diet plan." });
  }
});

const FOOD_DATABASE = {
  chicken: { calories: 165, protein: 31, carbs: 0, fat: 3.6, name: "Chicken Breast" },
  "chicken breast": { calories: 165, protein: 31, carbs: 0, fat: 3.6, name: "Chicken Breast" },
  beef: { calories: 250, protein: 26, carbs: 0, fat: 17, name: "Beef" },
  steak: { calories: 250, protein: 26, carbs: 0, fat: 17, name: "Steak" },
  rice: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3, name: "Cooked Rice" },
  "brown rice": { calories: 111, protein: 2.6, carbs: 23, fat: 0.9, name: "Cooked Brown Rice" },
  "white rice": { calories: 130, protein: 2.7, carbs: 28, fat: 0.3, name: "Cooked White Rice" },
  salmon: { calories: 208, protein: 20, carbs: 0, fat: 13, name: "Salmon Fillet" },
  tuna: { calories: 130, protein: 28, carbs: 0, fat: 1, name: "Tuna" },
  fish: { calories: 150, protein: 20, carbs: 0, fat: 5, name: "Fish" },
  broccoli: { calories: 34, protein: 2.8, carbs: 7, fat: 0.4, name: "Broccoli" },
  salad: { calories: 45, protein: 1.5, carbs: 6, fat: 2, name: "Mixed Salad" },
  spinach: { calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, name: "Spinach" },
  egg: { calories: 155, protein: 13, carbs: 1.1, fat: 11, name: "Egg" },
  eggs: { calories: 155, protein: 13, carbs: 1.1, fat: 11, name: "Egg" },
  "egg white": { calories: 52, protein: 11, carbs: 0.7, fat: 0.2, name: "Egg White" },
  "egg whites": { calories: 52, protein: 11, carbs: 0.7, fat: 0.2, name: "Egg White" },
  apple: { calories: 52, protein: 0.3, carbs: 14, fat: 0.2, name: "Apple" },
  banana: { calories: 89, protein: 1.1, carbs: 23, fat: 0.3, name: "Banana" },
  watermelon: { calories: 30, protein: 0.6, carbs: 8, fat: 0.2, name: "Watermelon" },
  orange: { calories: 47, protein: 0.9, carbs: 12, fat: 0.1, name: "Orange" },
  berries: { calories: 50, protein: 1, carbs: 12, fat: 0.5, name: "Mixed Berries" },
  strawberry: { calories: 32, protein: 0.7, carbs: 7.7, fat: 0.3, name: "Strawberry" },
  blueberries: { calories: 57, protein: 0.7, carbs: 14, fat: 0.3, name: "Blueberries" },
  pizza: { calories: 266, protein: 11, carbs: 33, fat: 10, name: "Pizza" },
  burger: { calories: 295, protein: 17, carbs: 24, fat: 14, name: "Burger" },
  pasta: { calories: 131, protein: 5, carbs: 25, fat: 1.1, name: "Cooked Pasta" },
  oats: { calories: 389, protein: 16.9, carbs: 66, fat: 6.9, name: "Rolled Oats" },
  oatmeal: { calories: 68, protein: 2.4, carbs: 12, fat: 1.4, name: "Oatmeal" },
  whey: { calories: 400, protein: 80, carbs: 6, fat: 6, name: "Whey Protein Powder" },
  "protein powder": { calories: 400, protein: 80, carbs: 6, fat: 6, name: "Protein Powder" },
  "peanut butter": { calories: 588, protein: 25, carbs: 20, fat: 50, name: "Peanut Butter" },
  milk: { calories: 50, protein: 3.3, carbs: 4.8, fat: 2, name: "Whole Milk" },
  "almond milk": { calories: 15, protein: 0.6, carbs: 0.3, fat: 1.2, name: "Almond Milk" },
  bread: { calories: 265, protein: 9, carbs: 49, fat: 3.2, name: "White Bread" },
  "whole wheat bread": { calories: 247, protein: 13, carbs: 41, fat: 3.4, name: "Whole Wheat Bread" },
  almonds: { calories: 579, protein: 21, carbs: 22, fat: 50, name: "Almonds" },
  walnuts: { calories: 654, protein: 15, carbs: 14, fat: 65, name: "Walnuts" },
  avocados: { calories: 160, protein: 2, carbs: 9, fat: 15, name: "Avocado" },
  avocado: { calories: 160, protein: 2, carbs: 9, fat: 15, name: "Avocado" },
  potato: { calories: 87, protein: 1.9, carbs: 20, fat: 0.1, name: "Boiled Potato" },
  potatoes: { calories: 87, protein: 1.9, carbs: 20, fat: 0.1, name: "Boiled Potato" },
  "sweet potato": { calories: 86, protein: 1.6, carbs: 20, fat: 0.1, name: "Sweet Potato" },
  yogurt: { calories: 59, protein: 10, carbs: 3.6, fat: 0.4, name: "Greek Yogurt" },
  "greek yogurt": { calories: 59, protein: 10, carbs: 3.6, fat: 0.4, name: "Greek Yogurt" },
  cheese: { calories: 402, protein: 25, carbs: 1.3, fat: 33, name: "Cheddar Cheese" },
  butter: { calories: 717, protein: 0.9, carbs: 0.1, fat: 81, name: "Butter" },
  oil: { calories: 884, protein: 0, carbs: 0, fat: 100, name: "Olive Oil" },
  "olive oil": { calories: 884, protein: 0, carbs: 0, fat: 100, name: "Olive Oil" },
  sugar: { calories: 387, protein: 0, carbs: 100, fat: 0, name: "Sugar" }
};

function getCalorieDetails(name, weightGrams) {
  const normName = name.toLowerCase().trim();
  let matchKey = Object.keys(FOOD_DATABASE).find(k => normName.includes(k) || k.includes(normName));
  const base = FOOD_DATABASE[matchKey] || { calories: 150, protein: 10, carbs: 15, fat: 5, name: name };

  const factor = weightGrams / 100;
  return {
    name: base.name,
    calories: Math.round(base.calories * factor),
    protein: Math.round(base.protein * factor),
    carbs: Math.round(base.carbs * factor),
    fat: Math.round(base.fat * factor),
    portion: `${weightGrams}g`
  };
}

// Mock Vision Analysis helper function
function getMockVisionAnalysis(fileName) {
  const name = (fileName || '').toLowerCase().trim();

  // 1. Default fallback keyword checks (for default filename fallbacks or specific inputs)
  if (name.includes('chicken') || name.includes('breast') || name.includes('poultry') || name.includes('quinoa')) {
    return {
      foodName: "Grilled Chicken & Quinoa with Broccoli",
      confidence: 96,
      totalCalories: 385,
      protein: 42,
      carbs: 28,
      fat: 12,
      fiber: 8,
      sugar: 3,
      sodium: 420,
      cholesterol: 85,
      potassium: 620,
      healthAnalysis: {
        isHealthy: true,
        suitableWeightLoss: true,
        suitableMuscleGain: true,
        suitableDiabetic: true,
        suitableHeartHealth: true,
        highProtein: true,
        highFat: false,
        highSugar: false,
        highSodium: false,
        isBalanced: true,
        healthScore: 92,
        explanation: "Excellent lean source of protein combined with complex carbohydrates from quinoa and high fiber from broccoli. Very balanced and heart-healthy."
      },
      recommendations: {
        bestTimeToEat: "Lunch or Post-Workout Meal",
        alternatives: ["Swap quinoa for brown rice", "Use turkey breast instead of chicken"],
        portionAdvice: "Maintain a 1:1 ratio of protein to vegetables",
        waterRecommendation: "Drink 300ml of water after eating",
        workoutRecommendation: "35 minutes of weight training or 30 minutes jogging",
        foodsToPairWith: ["Baby spinach salad", "Squeeze of fresh lemon"]
      },
      items: [
        { name: "Grilled Chicken Breast", calories: 220, protein: 35, carbs: 0, fat: 5, fiber: 0, sugar: 0, sodium: 280, cholesterol: 85, potassium: 330, portion: "150g" },
        { name: "Cooked Quinoa", calories: 120, protein: 4, carbs: 22, fat: 2, fiber: 3, sugar: 1, sodium: 10, cholesterol: 0, potassium: 170, portion: "100g" },
        { name: "Steamed Broccoli", calories: 45, protein: 3, carbs: 6, fat: 5, fiber: 5, sugar: 2, sodium: 130, cholesterol: 0, potassium: 120, portion: "1 cup" }
      ]
    };
  }

  if (name.includes('pizza') || name.includes('pepperoni') || name.includes('cheese')) {
    return {
      foodName: "Pepperoni Pizza Slices",
      confidence: 94,
      totalCalories: 680,
      protein: 26,
      carbs: 78,
      fat: 28,
      fiber: 4,
      sugar: 9,
      sodium: 1420,
      cholesterol: 65,
      potassium: 340,
      healthAnalysis: {
        isHealthy: false,
        suitableWeightLoss: false,
        suitableMuscleGain: false,
        suitableDiabetic: false,
        suitableHeartHealth: false,
        highProtein: false,
        highFat: true,
        highSugar: false,
        highSodium: true,
        isBalanced: false,
        healthScore: 40,
        explanation: "High in sodium, refined carbohydrates, and saturated fats. Lacks sufficient potassium and fiber."
      },
      recommendations: {
        bestTimeToEat: "Cheat Meal or Occasional Dinner",
        alternatives: ["Thin crust whole-wheat pizza", "Cauliflower crust pizza with chicken topping"],
        portionAdvice: "Limit to 2 slices and pair with a large side salad",
        waterRecommendation: "Drink 500ml water to balance the high sodium intake",
        workoutRecommendation: "60 minutes of brisk walking or 40 minutes of spin class",
        foodsToPairWith: ["Tossed green salad with light vinaigrette", "Iced green tea"]
      },
      items: [
        { name: "Pepperoni Pizza Slice (x2)", calories: 580, protein: 22, carbs: 70, fat: 24, fiber: 3, sugar: 7, sodium: 1200, cholesterol: 55, potassium: 280, portion: "2 slices" },
        { name: "Garlic Dipping Sauce", calories: 100, protein: 4, carbs: 8, fat: 4, fiber: 1, sugar: 2, sodium: 220, cholesterol: 10, potassium: 60, portion: "1 serving" }
      ]
    };
  }

  if (name.includes('salad') || name.includes('lettuce') || name.includes('green') || name.includes('bowl')) {
    return {
      foodName: "Mixed Green Salad with Feta",
      confidence: 97,
      totalCalories: 245,
      protein: 8,
      carbs: 16,
      fat: 18,
      fiber: 6,
      sugar: 5,
      sodium: 490,
      cholesterol: 15,
      potassium: 380,
      healthAnalysis: {
        isHealthy: true,
        suitableWeightLoss: true,
        suitableMuscleGain: false,
        suitableDiabetic: true,
        suitableHeartHealth: true,
        highProtein: false,
        highFat: false,
        highSugar: false,
        highSodium: false,
        isBalanced: true,
        healthScore: 88,
        explanation: "High in dietary fiber, vitamins, and minerals. Good healthy fats from vinaigrette, though protein is relatively low."
      },
      recommendations: {
        bestTimeToEat: "Lunch or Starter Meal",
        alternatives: ["Add grilled chicken or tofu for protein boost", "Use lemon juice instead of vinaigrette to cut fats"],
        portionAdvice: "Excellent volume-to-calorie ratio, eat as much as desired",
        waterRecommendation: "Drink 250ml water",
        workoutRecommendation: "20 minutes of light yoga or 15 minutes of cycling",
        foodsToPairWith: ["Grilled chicken breast", "Lentil soup"]
      },
      items: [
        { name: "Mixed Green Salad", calories: 60, protein: 2, carbs: 8, fat: 1, fiber: 4, sugar: 3, sodium: 40, cholesterol: 0, potassium: 220, portion: "2 cups" },
        { name: "Olive Oil & Vinaigrette", calories: 120, protein: 0, carbs: 2, fat: 13, fiber: 0, sugar: 1, sodium: 150, cholesterol: 0, potassium: 10, portion: "1.5 tbsp" },
        { name: "Feta Cheese Crumbs", calories: 65, protein: 6, carbs: 6, fat: 4, fiber: 2, sugar: 1, sodium: 300, cholesterol: 15, potassium: 150, portion: "25g" }
      ]
    };
  }

  if (name.includes('burger') || name.includes('patty') || name.includes('beef') || name.includes('fry') || name.includes('fries')) {
    return {
      foodName: "Beef Cheeseburger & French Fries",
      confidence: 95,
      totalCalories: 720,
      protein: 34,
      carbs: 64,
      fat: 36,
      fiber: 5,
      sugar: 12,
      sodium: 1250,
      cholesterol: 90,
      potassium: 540,
      healthAnalysis: {
        isHealthy: false,
        suitableWeightLoss: false,
        suitableMuscleGain: true,
        suitableDiabetic: false,
        suitableHeartHealth: false,
        highProtein: true,
        highFat: true,
        highSugar: false,
        highSodium: true,
        isBalanced: false,
        healthScore: 50,
        explanation: "Provides substantial protein and calories, but is offset by high levels of sodium, saturated fats, and refined carbs."
      },
      recommendations: {
        bestTimeToEat: "Post-workout (Bulking Phase) or Dinner",
        alternatives: ["Turkey burger on lettuce wrap", "Baked sweet potato fries instead of french fries"],
        portionAdvice: "Skip the high-calorie sauces and cheese to save 200 calories",
        waterRecommendation: "Drink 400ml water",
        workoutRecommendation: "50 minutes of high-intensity weight training or 45 minutes swimming",
        foodsToPairWith: ["Raw carrot sticks", "Sparkling water with lime"]
      },
      items: [
        { name: "Beef Cheeseburger", calories: 480, protein: 28, carbs: 38, fat: 24, fiber: 2, sugar: 6, sodium: 850, cholesterol: 80, potassium: 310, portion: "1 burger" },
        { name: "French Fries", calories: 240, protein: 6, carbs: 26, fat: 12, fiber: 3, sugar: 6, sodium: 400, cholesterol: 10, potassium: 230, portion: "1 small serving" }
      ]
    };
  }

  if (name.includes('apple') || name.includes('banana') || name.includes('fruit') || name.includes('berry') || name.includes('orange')) {
    return {
      foodName: "Fresh Fruit Bowl",
      confidence: 99,
      totalCalories: 155,
      protein: 2,
      carbs: 38,
      fat: 0.5,
      fiber: 6,
      sugar: 28,
      sodium: 5,
      cholesterol: 0,
      potassium: 420,
      healthAnalysis: {
        isHealthy: true,
        suitableWeightLoss: true,
        suitableMuscleGain: false,
        suitableDiabetic: false,
        suitableHeartHealth: true,
        highProtein: false,
        highFat: false,
        highSugar: true,
        isBalanced: false,
        healthScore: 82,
        explanation: "Rich in antioxidants, vitamins, and minerals. High natural sugar content means diabetics should consume in moderation."
      },
      recommendations: {
        bestTimeToEat: "Morning Breakfast or Mid-day Snack",
        alternatives: ["Add Greek yogurt to improve the protein balance", "Include a handful of almonds for healthy fats"],
        portionAdvice: "Limit total portion size to 1 cup per serving to control fructose intake",
        waterRecommendation: "Drink 200ml water",
        workoutRecommendation: "15 minutes of cardio or a 20-minute walk",
        foodsToPairWith: ["Raw walnuts", "Plain Greek yogurt"]
      },
      items: [
        { name: "Fresh Apple Slices", calories: 95, protein: 1, carbs: 25, fat: 0.3, fiber: 4, sugar: 19, sodium: 2, cholesterol: 0, potassium: 190, portion: "1 medium apple" },
        { name: "Mixed Berries", calories: 60, protein: 1, carbs: 13, fat: 0.2, fiber: 2, sugar: 9, sodium: 3, cholesterol: 0, potassium: 230, portion: "100g" }
      ]
    };
  }

  if (name.includes('sushi') || name.includes('salmon') || name.includes('fish') || name.includes('tuna')) {
    return {
      foodName: "Salmon & Tuna Sushi Combo",
      confidence: 95,
      totalCalories: 450,
      protein: 28,
      carbs: 58,
      fat: 10,
      fiber: 3,
      sugar: 6,
      sodium: 950,
      cholesterol: 45,
      potassium: 480,
      healthAnalysis: {
        isHealthy: true,
        suitableWeightLoss: true,
        suitableMuscleGain: true,
        suitableDiabetic: true,
        suitableHeartHealth: true,
        highProtein: true,
        highFat: false,
        highSugar: false,
        highSodium: false,
        isBalanced: true,
        healthScore: 90,
        explanation: "High in heart-healthy Omega-3 fatty acids and high-quality protein. White rice provides simple carbs, which can be balanced with low-sodium soy sauce."
      },
      recommendations: {
        bestTimeToEat: "Lunch or Post-Workout Meal",
        alternatives: ["Brown rice sushi rolls", "Salmon sashimi to minimize simple carbs"],
        portionAdvice: "Use low-sodium soy sauce and go easy on the pickled ginger",
        waterRecommendation: "Drink 350ml water",
        workoutRecommendation: "30 minutes of jogging or 30 minutes of rowing machine",
        foodsToPairWith: ["Seaweed salad (Wakame)", "Edamame pods"]
      },
      items: [
        { name: "Salmon Nigiri (x4)", calories: 240, protein: 16, carbs: 32, fat: 4, fiber: 1, sugar: 2, sodium: 400, cholesterol: 25, potassium: 260, portion: "4 pieces" },
        { name: "Spicy Tuna Roll (x6)", calories: 210, protein: 12, carbs: 26, fat: 6, fiber: 2, sugar: 4, sodium: 550, cholesterol: 20, potassium: 220, portion: "6 pieces" }
      ]
    };
  }

  if (name.includes('egg') || name.includes('scramble') || name.includes('omelet') || name.includes('breakfast') || name.includes('toast')) {
    return {
      foodName: "Scrambled Eggs & Sourdough Toast",
      confidence: 98,
      totalCalories: 360,
      protein: 20,
      carbs: 24,
      fat: 18,
      fiber: 2,
      sugar: 2,
      sodium: 680,
      cholesterol: 370,
      potassium: 290,
      healthAnalysis: {
        isHealthy: true,
        suitableWeightLoss: true,
        suitableMuscleGain: true,
        suitableDiabetic: true,
        suitableHeartHealth: false,
        highProtein: true,
        highFat: false,
        highSugar: false,
        highSodium: false,
        isBalanced: true,
        healthScore: 89,
        explanation: "Excellent breakfast option. Eggs offer a complete protein source and essential choline, while sourdough is easier on digestion than standard white bread."
      },
      recommendations: {
        bestTimeToEat: "Breakfast or Morning Post-Workout",
        alternatives: ["Use egg whites to reduce fat/calories/cholesterol", "Swap butter for avocado spread"],
        portionAdvice: "Perfect morning fuel portion to sustain energy for 4-5 hours",
        waterRecommendation: "Drink 300ml water",
        workoutRecommendation: "25 minutes of strength training or 30 minutes brisk walking",
        foodsToPairWith: ["Fresh orange slices", "Black coffee or herbal tea"]
      },
      items: [
        { name: "Scrambled Eggs (x2)", calories: 140, protein: 12, carbs: 1, fat: 10, fiber: 0, sugar: 0, sodium: 320, cholesterol: 370, potassium: 140, portion: "2 eggs" },
        { name: "Sourdough Toast (x2)", calories: 160, protein: 6, carbs: 22, fat: 1, fiber: 2, sugar: 1, sodium: 300, cholesterol: 0, potassium: 90, portion: "2 slices" },
        { name: "Salted Butter Spread", calories: 60, protein: 2, carbs: 1, fat: 7, fiber: 0, sugar: 1, sodium: 60, cholesterol: 0, potassium: 60, portion: "1 pat" }
      ]
    };
  }

  // 2. Try to parse using regex for weights / amounts
  let parsedItems = [];
  let match;
  const itemRegex = /(\d+(?:\.\d+)?)\s*(g|gram|grams|kg|kilogram|kilograms)?\s*(?:of\s+)?([a-zA-Z\s\-_]+?)(?:and|,|\.|$)/gi;
  while ((match = itemRegex.exec(name)) !== null) {
    let val = parseFloat(match[1]);
    let unitStr = (match[2] || 'g').toLowerCase();
    let nameStr = match[3].trim();
    nameStr = nameStr.replace(/^(had|ate|took|eat|consumed|with)\s+/i, '').trim();
    if (!nameStr) continue;

    let weightGrams = val;
    if (unitStr.startsWith('kg') || unitStr.startsWith('kilogram')) {
      weightGrams = val * 1000;
    }

    const details = getCalorieDetails(nameStr, weightGrams);
    // Add default nutrients for individual items parsed dynamically
    details.fiber = Math.round(details.calories * 0.015);
    details.sugar = Math.round(details.carbs * 0.15);
    details.sodium = Math.round(details.calories * 1.2);
    details.cholesterol = Math.round(details.fat * 2.5);
    details.potassium = Math.round(details.protein * 12 + details.carbs * 4);
    parsedItems.push(details);
  }

  // 3. If no weights matched, look for keywords in the string directly
  if (parsedItems.length === 0) {
    const keywords = Object.keys(FOOD_DATABASE);
    for (const key of keywords) {
      if (name.includes(key)) {
        const details = getCalorieDetails(key, 150);
        details.fiber = Math.round(details.calories * 0.015);
        details.sugar = Math.round(details.carbs * 0.15);
        details.sodium = Math.round(details.calories * 1.2);
        details.cholesterol = Math.round(details.fat * 2.5);
        details.potassium = Math.round(details.protein * 12 + details.carbs * 4);
        parsedItems.push(details); // Default to 150g portion
      }
    }
  }

  // 4. If we matched items from keywords, return them!
  if (parsedItems.length > 0) {
    let totalCalories = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;
    let fiber = 0;
    let sugar = 0;
    let sodium = 0;
    let cholesterol = 0;
    let potassium = 0;
    parsedItems.forEach(item => {
      totalCalories += item.calories;
      protein += item.protein;
      carbs += item.carbs;
      fat += item.fat;
      fiber += (item.fiber || 0);
      sugar += (item.sugar || 0);
      sodium += (item.sodium || 0);
      cholesterol += (item.cholesterol || 0);
      potassium += (item.potassium || 0);
    });

    let dominantName = parsedItems.map(item => item.name).join(' & ');
    if (dominantName.length > 40) {
      dominantName = parsedItems[0].name + " & others";
    }

    const isHealthy = (protein > 15 && sugar < 15 && sodium < 800);
    const healthScore = isHealthy ? 85 : 55;

    return {
      foodName: dominantName,
      confidence: 96,
      totalCalories,
      protein,
      carbs,
      fat,
      fiber,
      sugar,
      sodium,
      cholesterol,
      potassium,
      items: parsedItems,
      healthAnalysis: {
        isHealthy,
        suitableWeightLoss: totalCalories < 500,
        suitableMuscleGain: protein > 25,
        suitableDiabetic: sugar < 8 && carbs < 45,
        suitableHeartHealth: sodium < 600 && fat < 15,
        highProtein: protein > 25,
        highFat: fat > 18,
        highSugar: sugar > 15,
        highSodium: sodium > 700,
        isBalanced: (protein > 10 && carbs > 10 && fat > 5),
        healthScore,
        explanation: `Custom calibrated nutrition profile. Estimated health score of ${healthScore}/100 based on macro distribution.`
      },
      recommendations: {
        bestTimeToEat: "Lunch or Post-Workout",
        alternatives: ["Swap sides with steamed greens", "Use minimal added cooking oils"],
        portionAdvice: "Consume a balanced portion under 500g.",
        waterRecommendation: "Drink 250ml water following this meal.",
        workoutRecommendation: `30-40 minutes running or active cycling to burn ${totalCalories} calories.`,
        foodsToPairWith: ["Mixed green salad", "Fresh fruit slice"]
      }
    };
  }

  // Default fallback if no keywords match at all (e.g. general camera capture with no name, or generic name)
  return {
    foodName: "Healthy Protein Salad Bowl",
    confidence: 94,
    totalCalories: 420,
    protein: 24,
    carbs: 32,
    fat: 16,
    fiber: 6,
    sugar: 4,
    sodium: 480,
    cholesterol: 185,
    potassium: 420,
    healthAnalysis: {
      isHealthy: true,
      suitableWeightLoss: true,
      suitableMuscleGain: true,
      suitableDiabetic: true,
      suitableHeartHealth: true,
      highProtein: false,
      highFat: false,
      highSugar: false,
      highSodium: false,
      isBalanced: true,
      healthScore: 92,
      explanation: "Excellent balanced meal containing high dietary fiber, lean protein from hard-boiled eggs, healthy monounsaturated fats from avocado, and antioxidant-rich vegetables."
    },
    recommendations: {
      bestTimeToEat: "Lunch or Post-Workout Meal",
      alternatives: ["Swap dressing for lemon vinaigrette", "Add grilled tofu or chicken breast for extra protein"],
      portionAdvice: "A very nutrient-dense and satisfying choice. Keep portion sizes around 350-400g.",
      waterRecommendation: "Drink 300ml of water following this meal.",
      workoutRecommendation: "35 minutes of moderate jogging or 25 minutes of high-intensity spin class.",
      foodsToPairWith: ["Fresh berries bowl", "Hot green tea"]
    },
    items: [
      { name: "Hard Boiled Eggs (x2)", calories: 140, protein: 12, carbs: 1, fat: 10, fiber: 0, sugar: 0, sodium: 120, cholesterol: 185, potassium: 140, portion: "2 eggs" },
      { name: "Avocado Slices", calories: 120, protein: 1.5, carbs: 6, fat: 11, fiber: 5, sugar: 0.5, sodium: 5, cholesterol: 0, potassium: 120, portion: "80g" },
      { name: "Mixed Vegetables (Brussels Sprouts & Tomatoes)", calories: 110, protein: 6.5, carbs: 19, fat: 1, fiber: 6, sugar: 3, sodium: 145, cholesterol: 0, potassium: 100, portion: "1.5 cups" },
      { name: "Healthy Olive Oil Dressing", calories: 50, protein: 0, carbs: 6, fat: 4, fiber: 1, sugar: 0.5, sodium: 210, cholesterol: 0, potassium: 60, portion: "1 tbsp" }
    ]
  };
}

// 4i. AI Food Scanning REST API Endpoint
app.post('/api/scan-food', async (req, res) => {
  try {
    const { image, name, email } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'Image data is required.' });
    }

    const clientKey = req.headers['x-gemini-key'];
    const geminiKey = clientKey || process.env.GEMINI_API_KEY;

    if (geminiKey) {
      try {
        let mimeType = 'image/jpeg';
        let base64Data = image;
        if (image.startsWith('data:')) {
          const parts = image.split(';base64,');
          mimeType = parts[0].split(':')[1];
          base64Data = parts[1];
        }

        const prompt = `Identify all the food items present in this image. For each item, estimate its portion/weight, and its approximate calories, protein (g), carbs (g), fat (g), fiber (g), sugar (g), sodium (mg), cholesterol (mg), and potassium (mg). Calculate the overall total calories and total macros/micronutrients for the entire meal (including fiber, sugar, sodium, cholesterol, potassium). Perform a health analysis on the meal (suitabilities, flags, balance, health score 0-100, explanation), and generate personalized recommendations (best time to eat, portion advice, water amount, healthier alternatives, suggested workout to burn it, and foods to pair with this meal).
        If the image is blurry, low quality, contains non-food items, or has no detectable food, set the "confidence" field below 70%.
        
        You must respond ONLY with a JSON object in this exact format (do not include markdown formatting, code blocks, backticks, or comments):
        {
          "foodName": "name of the overall meal",
          "confidence": 95,
          "totalCalories": 450,
          "protein": 35,
          "carbs": 40,
          "fat": 15,
          "fiber": 6,
          "sugar": 5,
          "sodium": 350,
          "cholesterol": 20,
          "potassium": 450,
          "items": [
            { "name": "Item Name", "calories": 250, "protein": 30, "carbs": 5, "fat": 8, "fiber": 2, "sugar": 1, "sodium": 150, "cholesterol": 15, "potassium": 280, "portion": "150g" }
          ],
          "healthAnalysis": {
            "isHealthy": true,
            "suitableWeightLoss": true,
            "suitableMuscleGain": true,
            "suitableDiabetic": true,
            "suitableHeartHealth": true,
            "highProtein": true,
            "highFat": false,
            "highSugar": false,
            "highSodium": false,
            "isBalanced": true,
            "healthScore": 85,
            "explanation": "Brief explanation of healthiness and why it is suitable or has certain flags"
          },
          "recommendations": {
            "bestTimeToEat": "Post-workout or Lunch",
            "alternatives": ["Quinoa instead of white rice", "Steamed instead of fried vegetables"],
            "portionAdvice": "Keep portion size under 400g to manage caloric density",
            "waterRecommendation": "Drink 300ml of water 15 minutes after eating",
            "workoutRecommendation": "40 minutes of moderate cycling or 30 minutes HIIT run to burn 450 kcal",
            "foodsToPairWith": ["Mixed green salad", "Greek yogurt spread"]
          }
        }`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  { inlineData: { mimeType, data: base64Data } }
                ]
              }
            ],
            generationConfig: {
              responseMimeType: "application/json"
            }
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Gemini API error: ${response.status} ${errText}`);
        }

        const resultJson = await response.json();
        const responseText = resultJson.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) {
          throw new Error("No response text from Gemini API.");
        }

        const data = JSON.parse(responseText);
        return res.status(200).json(data);
      } catch (geminiError) {
        console.error("Gemini AI failed, using fallback mock analyzer:", geminiError);
        const mockData = getMockVisionAnalysis(name);
        mockData.simulated = true;
        mockData.warning = "Gemini API key call failed. Showing simulated analysis.";
        return res.status(200).json(mockData);
      }
    } else {
      const mockData = getMockVisionAnalysis(name);
      mockData.simulated = true;
      return res.status(200).json(mockData);
    }
  } catch (error) {
    console.error("Scan food error:", error);
    res.status(500).json({ error: "Failed to scan food image." });
  }
});

// 4i-2. Analyze Manual Text Food Entry API Endpoint
app.post('/api/analyze-text-food', async (req, res) => {
  try {
    const { text, foodName, weight, unit, email } = req.body;

    // If we have Gemini API Key, try calling Gemini for highest accuracy text parsing
    if (process.env.GEMINI_API_KEY) {
      try {
        let promptText = "";
        if (text) {
          promptText = `Analyze this food intake description: "${text}".`;
        } else if (foodName && weight) {
          promptText = `Analyze this food intake: ${weight}${unit} of ${foodName}.`;
        } else {
          return res.status(400).json({ error: "Invalid text input details." });
        }

        const prompt = `${promptText} Identify each item, estimate/extract its portion/weight, and its approximate calories, protein (g), carbs (g), fat (g), fiber (g), sugar (g), sodium (mg), cholesterol (mg), and potassium (mg). Calculate the overall total calories and total macros/micronutrients for the entire meal. Perform a health analysis on the meal (suitabilities, flags, balance, health score 0-100, explanation), and generate personalized recommendations (best time to eat, portion advice, water amount, healthier alternatives, suggested workout to burn it, and foods to pair with this meal).
        You must respond ONLY with a JSON object in this exact format (no markdown formatting, no code blocks, no backticks, no comments):
        {
          "foodName": "name of the overall meal",
          "confidence": 100,
          "totalCalories": 450,
          "protein": 35,
          "carbs": 40,
          "fat": 15,
          "fiber": 6,
          "sugar": 5,
          "sodium": 350,
          "cholesterol": 20,
          "potassium": 450,
          "items": [
            { "name": "Item Name", "calories": 250, "protein": 30, "carbs": 5, "fat": 8, "fiber": 2, "sugar": 1, "sodium": 150, "cholesterol": 15, "potassium": 280, "portion": "150g" }
          ],
          "healthAnalysis": {
            "isHealthy": true,
            "suitableWeightLoss": true,
            "suitableMuscleGain": true,
            "suitableDiabetic": true,
            "suitableHeartHealth": true,
            "highProtein": true,
            "highFat": false,
            "highSugar": false,
            "highSodium": false,
            "isBalanced": true,
            "healthScore": 85,
            "explanation": "Brief explanation of healthiness and why it is suitable or has certain flags"
          },
          "recommendations": {
            "bestTimeToEat": "Post-workout or Lunch",
            "alternatives": ["Quinoa instead of white rice", "Steamed instead of fried vegetables"],
            "portionAdvice": "Keep portion size under 400g to manage caloric density",
            "waterRecommendation": "Drink 300ml of water 15 minutes after eating",
            "workoutRecommendation": "40 minutes of moderate cycling or 30 minutes HIIT run to burn 450 kcal",
            "foodsToPairWith": ["Mixed green salad", "Greek yogurt spread"]
          }
        }`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });

        if (response.ok) {
          const resultJson = await response.json();
          const responseText = resultJson.candidates?.[0]?.content?.parts?.[0]?.text;
          if (responseText) {
            const data = JSON.parse(responseText);
            return res.status(200).json(data);
          }
        }
      } catch (geminiError) {
        console.error("Gemini text analysis failed, using local database parser:", geminiError);
      }
    }

    // Local database parser fallback (when Gemini key is absent or fails)
    let items = [];
    let dominantMealName = "Logged Meal";

    if (foodName && weight) {
      let weightGrams = parseFloat(weight);
      if (unit === 'kg') weightGrams *= 1000;
      const details = getCalorieDetails(foodName, weightGrams);
      items.push(details);
      dominantMealName = details.name;
    } else if (text) {
      let match;
      const itemRegex = /(\d+(?:\.\d+)?)\s*(g|gram|grams|kg|kilogram|kilograms)?\s*(?:of\s+)?([a-zA-Z\s\-_]+?)(?:and|,|\.|$)/gi;
      while ((match = itemRegex.exec(text)) !== null) {
        let val = parseFloat(match[1]);
        let unitStr = (match[2] || 'g').toLowerCase();
        let nameStr = match[3].trim();
        nameStr = nameStr.replace(/^(had|ate|took|eat|consumed|with)\s+/i, '').trim();
        if (!nameStr) continue;

        let weightGrams = val;
        if (unitStr.startsWith('kg') || unitStr.startsWith('kilogram')) {
          weightGrams = val * 1000;
        }

        const details = getCalorieDetails(nameStr, weightGrams);
        items.push(details);
      }

      if (items.length === 0) {
        const words = text.toLowerCase().split(/\s+/);
        for (const word of words) {
          const cleaned = word.replace(/[^a-z]/g, '');
          if (FOOD_DATABASE[cleaned]) {
            items.push(getCalorieDetails(cleaned, 150));
          }
        }
      }

      if (items.length > 0) {
        dominantMealName = items.map(item => item.name).join(' & ');
        if (dominantMealName.length > 40) {
          dominantMealName = items[0].name + " & others";
        }
      } else {
        items.push({
          name: text.substring(0, 30),
          calories: 250,
          protein: 10,
          carbs: 30,
          fat: 8,
          portion: "1 portion"
        });
        dominantMealName = text.substring(0, 30);
      }
    }

    let totalCalories = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;
    items.forEach(item => {
      totalCalories += item.calories;
      protein += item.protein;
      carbs += item.carbs;
      fat += item.fat;
    });

    const payload = {
      foodName: dominantMealName,
      confidence: 100,
      totalCalories,
      protein,
      carbs,
      fat,
      items,
      simulated: true
    };
    return res.status(200).json(payload);
  } catch (error) {
    console.error("Text analyze error:", error);
    res.status(500).json({ error: "Failed to analyze food text." });
  }
});

// 4j. Log Nutrition Intake
app.post('/api/nutrition/log', async (req, res) => {
  try {
    const { email, foodName, calories, protein, carbs, fat, fiber, sugar, sodium, cholesterol, potassium, healthAnalysis, recommendations, items, imageUrl, date } = req.body;
    if (!email || !foodName || !calories) {
      return res.status(400).json({ error: 'Email, food name, and calories are required.' });
    }

    const logDate = date ? new Date(date) : new Date();

    const logEntry = new NutritionLog({
      email: email.toLowerCase(),
      foodName,
      calories: Math.round(Number(calories)),
      protein: Math.round(Number(protein || 0)),
      carbs: Math.round(Number(carbs || 0)),
      fat: Math.round(Number(fat || 0)),
      fiber: Math.round(Number(fiber || 0)),
      sugar: Math.round(Number(sugar || 0)),
      sodium: Math.round(Number(sodium || 0)),
      cholesterol: Math.round(Number(cholesterol || 0)),
      potassium: Math.round(Number(potassium || 0)),
      healthAnalysis: healthAnalysis || null,
      recommendations: recommendations || null,
      items: items || [],
      imageUrl,
      date: logDate
    });

    await logEntry.save();
    res.status(201).json({ message: 'Nutrition intake logged successfully.', log: logEntry });
  } catch (error) {
    console.error("Log nutrition error:", error);
    res.status(500).json({ error: "Failed to log nutrition intake." });
  }
});

// 4k. Get Nutrition Logs
app.get('/api/nutrition/logs', async (req, res) => {
  try {
    const { email, date } = req.query;
    if (!email) {
      return res.status(400).json({ error: 'User email is required.' });
    }

    let query = { email: email.toLowerCase() };

    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate.setUTCHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setUTCHours(23, 59, 59, 999));
      query.date = { $gte: startOfDay, $lte: endOfDay };
    }

    const logs = await NutritionLog.find(query).sort({ date: -1 });
    res.status(200).json({ logs });
  } catch (error) {
    console.error("Get nutrition logs error:", error);
    res.status(500).json({ error: "Failed to retrieve nutrition logs." });
  }
});

// 4l. Delete Nutrition Log
app.delete('/api/nutrition/log/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: 'User email is required to delete log.' });
    }

    const log = await NutritionLog.findOneAndDelete({ _id: id, email: email.toLowerCase() });
    if (!log) {
      return res.status(404).json({ error: 'Nutrition log entry not found or unauthorized.' });
    }

    res.status(200).json({ message: 'Log entry deleted successfully.' });
  } catch (error) {
    console.error("Delete nutrition log error:", error);
    res.status(500).json({ error: "Failed to delete log entry." });
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
