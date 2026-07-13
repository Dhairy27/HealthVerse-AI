require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fitforge';

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
  },
  workoutPlan: { type: Object, default: null }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

const workoutSchema = new mongoose.Schema({
  email: { type: String, required: true },
  duration: { type: Number, required: true }, // in seconds
  steps: { type: Number, required: true },
  distance: { type: Number, required: true }, // in meters
  calories: { type: Number },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

const Workout = mongoose.model('Workout', workoutSchema);


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
    let exercises = [];

    // Base volume parameters
    let sets = 3;
    let restSecs = 75;
    let volumeTag = 'Beginner';

    if (proto.activityLevel === 'moderate') {
      sets = 4;
      restSecs = 60;
      volumeTag = 'Intermediate';
    } else if (proto.activityLevel === 'high') {
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

    let days = {};

    if (goalsStr.includes('muscle') || goalsStr.includes('strength') || goalsStr.includes('hypertrophy')) {
      planType = 'Hypertrophy & Neuromuscular Power Program';
      planDescription = 'Optimized weekly progressive overload split designed to maximize myofibrillar protein synthesis and raw force development.';
      
      days = {
        1: {
          name: "Day 1: Upper Body Push Force",
          exercises: [
            { name: "Dumbbell Flat Bench Press", sets: sets, reps: "8-12", target: "Pectoralis Major, Anterior Deltoids, Triceps", hold: "1s peak squeeze", image: placeholderImg },
            { name: "Standing Overhead Press", sets: sets - 1, reps: "8-10", target: "Anterior/Lateral Deltoids, Core Stabilizers", hold: "None", image: placeholderImg },
            { name: "Dumbbell Lateral Raises", sets: sets, reps: "12-15", target: "Lateral Deltoids", hold: "1s peak contraction", image: placeholderImg }
          ]
        },
        2: {
          name: "Day 2: Posterior Chain Pull Density",
          exercises: [
            { name: jointFriendly ? "Weighted Hip Thrusts" : "Dumbbell Romanian Deadlift", sets: sets, reps: "8-10", target: "Gluteus Maximus, Hamstrings, Erector Spinae", hold: "1s hold", image: placeholderImg },
            { name: "Chest-Supported Row", sets: sets, reps: "10-12", target: "Latissimus Dorsi, Rhomboids, Trapezius", hold: "1s squeeze", image: placeholderImg },
            { name: "Seated Hammer Curls", sets: sets - 1, reps: "12", target: "Brachialis, Biceps Brachii", hold: "None", image: placeholderImg }
          ]
        },
        3: {
          name: "Day 3: Lower Body Squat Volume",
          exercises: [
            { name: jointFriendly ? "Goblet Box Squats" : "Barbell Back Squats", sets: sets, reps: "8-10", target: "Quadriceps, Gluteus Maximus", hold: "None", image: placeholderImg },
            { name: "Bulgarian Split Squats", sets: sets - 1, reps: "10-12 per leg", target: "Quadriceps, Glute Medius", hold: "None", image: placeholderImg },
            { name: "Standing Calf Raises", sets: sets, reps: "15", target: "Gastrocnemius, Soleus", hold: "2s stretch", image: placeholderImg }
          ]
        },
        4: {
          name: "Day 4: Core & Active Regeneration",
          exercises: [
            { name: "Plank Hold", sets: 3, reps: "45s-60s", target: "Rectus Abdominis, Transverse Abdominis", hold: "Active hollow body", image: placeholderImg },
            { name: "Bird-Dog Extensions", sets: 3, reps: "12 per side", target: "Erector Spinae, Glutes, Deltoids", hold: "2s hold at peak", image: placeholderImg },
            { name: "Cobra Pose Stretch", sets: 2, reps: "30s", target: "Abdominals, Hip Flexors", hold: "Static stretch", image: placeholderImg }
          ]
        },
        5: {
          name: "Day 5: Upper Body Hypertrophy Split",
          exercises: [
            { name: "Incline Dumbbell Press", sets: sets, reps: "10-12", target: "Upper Pectorals, Anterior Deltoids", hold: "None", image: placeholderImg },
            { name: "Wide Grip Lat Pulldown", sets: sets, reps: "10-12", target: "Latissimus Dorsi, Teres Major", hold: "1s contraction", image: placeholderImg },
            { name: "Dumbbell Tricep Overhead Extensions", sets: sets - 1, reps: "12", target: "Triceps (Long Head)", hold: "None", image: placeholderImg }
          ]
        },
        6: {
          name: "Day 6: Metabolic Engine Synthesis",
          exercises: [
            { name: "Dumbbell Thrusters", sets: sets, reps: "12-15", target: "Full Body, Cardiovascular System", hold: "None", image: placeholderImg },
            { name: "Russian Kettlebell Swings", sets: sets, reps: "20", target: "Hamstrings, Glutes, Lower Back", hold: "None", image: placeholderImg },
            { name: "Hanging Knee Raises", sets: sets, reps: "15", target: "Rectus Abdominis", hold: "1s peak hold", image: placeholderImg }
          ]
        },
        7: {
          name: "Day 7: Neuromuscular Recovery & Mobility",
          exercises: [
            { name: "Child's Pose Stretch", sets: 2, reps: "60s", target: "Lats, Lower Back, Shoulders", hold: "Static stretch", image: placeholderImg },
            { name: "Shoulder Pass-Throughs", sets: 3, reps: "10", target: "Rotator Cuff, Chest Mobility", hold: "None", image: placeholderImg },
            { name: "Dynamic Hip Opener Flow", sets: 2, reps: "10 per side", target: "Psoas, Adductors", hold: "Active stretching", image: placeholderImg }
          ]
        }
      };
    } else if (goalsStr.includes('fat') || goalsStr.includes('cardio') || goalsStr.includes('weight')) {
      planType = 'High-Intensity Metabolic Synthesis Program';
      planDescription = 'High-density conditioning split using complex movement patterns to elevate excess post-exercise oxygen consumption (EPOC) and maximize daily energy expenditure.';
      
      days = {
        1: {
          name: "Day 1: High Intensity Metabolic Blast",
          exercises: [
            { name: "Dumbbell Thrusters", sets: sets, reps: "12-15", target: "Full Body, Cardio", hold: "None", image: placeholderImg },
            { name: "Russian Kettlebell Swings", sets: sets, reps: "20", target: "Posterior Chain, Cardio", hold: "None", image: placeholderImg },
            { name: "Mountain Climbers", sets: 3, reps: "45s", target: "Core, Cardiovascular endurance", hold: "None", image: placeholderImg }
          ]
        },
        2: {
          name: "Day 2: Posterior Chain & Core Strength",
          exercises: [
            { name: "Dumbbell Romanian Deadlift", sets: sets, reps: "12", target: "Glutes, Hamstrings", hold: "None", image: placeholderImg },
            { name: "Plank Shoulder Taps", sets: 3, reps: "15 per side", target: "Transverse Abdominis, Deltoids", hold: "None", image: placeholderImg },
            { name: "Bicycle Crunches", sets: 3, reps: "20 per side", target: "Rectus Abdominis, Obliques", hold: "None", image: placeholderImg }
          ]
        },
        3: {
          name: "Day 3: Upper Body Conditioning",
          exercises: [
            { name: "Dumbbell Push Press", sets: sets, reps: "12", target: "Shoulders, Triceps", hold: "None", image: placeholderImg },
            { name: "Dumbbell Incline Row", sets: sets, reps: "12", target: "Upper Back, Lats", hold: "None", image: placeholderImg },
            { name: jointFriendly ? "Wall Pushups" : "Incline Pushups", sets: sets, reps: "15", target: "Chest, Triceps", hold: "None", image: placeholderImg }
          ]
        },
        4: {
          name: "Day 4: Active Recovery & Flow",
          exercises: [
            { name: "Cat-Cow Stretch", sets: 2, reps: "60s", target: "Spinal Mobility, Core Relief", hold: "Active breathing", image: placeholderImg },
            { name: "Child's Pose", sets: 2, reps: "60s", target: "Lats, Lower Back, Hips", hold: "Static stretch", image: placeholderImg },
            { name: "Bird-Dog Extensions", sets: 3, reps: "10 per side", target: "Lower Back, Glutes", hold: "2s hold", image: placeholderImg }
          ]
        },
        5: {
          name: "Day 5: Lower Body Metabolic Burn",
          exercises: [
            { name: "Goblet Squats", sets: sets, reps: "15", target: "Quadriceps, Glutes", hold: "None", image: placeholderImg },
            { name: jointFriendly ? "Alternating Reverse Lunges" : "Alternating Lunge Jumps", sets: sets - 1, reps: "12 per leg", target: "Lower Body Explosiveness", hold: "None", image: placeholderImg },
            { name: "Glute Bridge Squeezes", sets: sets, reps: "20", target: "Gluteus Maximus", hold: "2s squeeze at peak", image: placeholderImg }
          ]
        },
        6: {
          name: "Day 6: Cardio Engine Sprint",
          exercises: [
            { name: jointFriendly ? "Half-Burpees (No Jump)" : "Full Burpees", sets: sets, reps: "10-12", target: "Full Body conditioning", hold: "None", image: placeholderImg },
            { name: "Mountain Climbers", sets: 3, reps: "45s", target: "Core, Cardio", hold: "None", image: placeholderImg },
            { name: "High Knees Sprint", sets: 3, reps: "30s", target: "Aerobic Engine", hold: "None", image: placeholderImg }
          ]
        },
        7: {
          name: "Day 7: Active Recovery & Mobility",
          exercises: [
            { name: "Cobra Pose", sets: 2, reps: "45s", target: "Abdominals, Hip Flexors", hold: "Static stretch", image: placeholderImg },
            { name: "Dynamic Hip Openers", sets: 2, reps: "10 per leg", target: "Hip flexors, Hamstrings", hold: "Active stretching", image: placeholderImg },
            { name: "Hamstring Static Stretch", sets: 2, reps: "30s per leg", target: "Posterior leg chain", hold: "Static", image: placeholderImg }
          ]
        }
      };
    } else {
      planType = 'Aerobic & Anaerobic Conditioning Program';
      planDescription = 'High-repetition split designed to increase mitochondrial density, lactic acid clearance rate, and active sports performance capacity.';
      
      days = {
        1: {
          name: "Day 1: Upper Body Endurance & Stabilizers",
          exercises: [
            { name: jointFriendly ? "Incline Wall Pushups" : "Pushups (High Rep)", sets: sets, reps: "15-20", target: "Chest, Shoulders, Triceps", hold: "None", image: placeholderImg },
            { name: "Dumbbell Bent-Over Row", sets: sets, reps: "15", target: "Latissimus Dorsi, Back", hold: "None", image: placeholderImg },
            { name: "Plank-to-Pushup Flow", sets: sets - 1, reps: "10", target: "Shoulders, Chest, Core endurance", hold: "None", image: placeholderImg }
          ]
        },
        2: {
          name: "Day 2: Lower Body Unilateral Stability",
          exercises: [
            { name: "Bulgarian Split Squats", sets: sets, reps: "12-15 per leg", target: "Quadriceps, Glutes, Unilateral Balance", hold: "None", image: placeholderImg },
            { name: "Dumbbell Step-Ups", sets: sets - 1, reps: "12 per leg", target: "Quads, Hip Flexors, Glutes", hold: "None", image: placeholderImg },
            { name: "Single Leg Glute Bridges", sets: sets, reps: "12 per side", target: "Hamstrings, Glute Medius", hold: "1s squeeze", image: placeholderImg }
          ]
        },
        3: {
          name: "Day 3: Back & Core Stamina",
          exercises: [
            { name: "Wide Grip Lat Pulldown", sets: sets, reps: "12-15", target: "Latissimus Dorsi", hold: "None", image: placeholderImg },
            { name: "Hanging Knee Raises", sets: sets, reps: "15", target: "Rectus Abdominis", hold: "1s peak hold", image: placeholderImg },
            { name: "Russian Twists", sets: 3, reps: "20 per side", target: "Obliques, Core", hold: "None", image: placeholderImg }
          ]
        },
        4: {
          name: "Day 4: Active Recovery / Flow",
          exercises: [
            { name: "Cat-Cow Stretch", sets: 2, reps: "60s", target: "Spinal Mobility, Core Relief", hold: "Active breathing", image: placeholderImg },
            { name: "Child's Pose", sets: 2, reps: "60s", target: "Lats, Lower Back, Hips", hold: "Static stretch", image: placeholderImg },
            { name: "Bird-Dog Extensions", sets: 3, reps: "10 per side", target: "Lower Back, Glutes", hold: "2s hold", image: placeholderImg }
          ]
        },
        5: {
          name: "Day 5: Lower Body Quadriceps Endurance",
          exercises: [
            { name: "Goblet Squats", sets: sets, reps: "15", target: "Quadriceps, Glutes", hold: "None", image: placeholderImg },
            { name: "Walking Lunges", sets: sets - 1, reps: "15 per leg", target: "Quads, Hamstrings, Balance", hold: "None", image: placeholderImg },
            { name: "Bodyweight Squats (High Rep)", sets: 3, reps: "25", target: "Muscular Endurance", hold: "None", image: placeholderImg }
          ]
        },
        6: {
          name: "Day 6: Full Body Conditioning",
          exercises: [
            { name: "Russian Kettlebell Swings", sets: sets, reps: "20", target: "Posterior Chain, Cardio", hold: "None", image: placeholderImg },
            { name: "Dumbbell Thrusters", sets: sets - 1, reps: "12", target: "Full Body, Cardio", hold: "None", image: placeholderImg },
            { name: "Mountain Climbers", sets: 3, reps: "45s", target: "Core, Cardio", hold: "None", image: placeholderImg }
          ]
        },
        7: {
          name: "Day 7: Active Recovery / Joint Mobility",
          exercises: [
            { name: "Shoulder Mobility Drills", sets: 2, reps: "12", target: "Shoulder Rotators", hold: "None", image: placeholderImg },
            { name: "Foam Rolling Flow", sets: 1, reps: "5 mins", target: "Myofascial Release", hold: "None", image: placeholderImg },
            { name: "Child's Pose Stretch", sets: 2, reps: "60s", target: "Lats, Lower Back", hold: "Static", image: placeholderImg }
          ]
        }
      };
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
    const { email, duration, steps, distance, calories } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'User email is required to save workout.' });
    }
    const workout = new Workout({
      email: email.toLowerCase(),
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
