const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const { connectToDatabase } = require('../lib/db');

// Helper to authenticate user via JWT
function authenticateToken(req) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) return null;

  try {
    const jwtSecret = process.env.JWT_SECRET;
    return jwt.verify(token, jwtSecret);
  } catch (err) {
    return null;
  }
}

module.exports = async (req, res) => {
  const userPayload = authenticateToken(req);

  if (!userPayload) {
    return res.status(401).json({ error: 'Unauthorized session.' });
  }

  const { db } = await connectToDatabase();
  const usersCollection = db.collection('users');
  
  let userId;
  try {
    userId = new ObjectId(userPayload.userId);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid User ID format.' });
  }

  // GET: Retrieve user state
  if (req.method === 'GET') {
    try {
      const user = await usersCollection.findOne({ _id: userId });
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }
      return res.status(200).json({ state: user.appState || null });
    } catch (error) {
      console.error('Error fetching state:', error);
      return res.status(500).json({ error: 'Database error retrieving state.' });
    }
  }

  // POST: Save user state
  if (req.method === 'POST') {
    const { state } = req.body;
    if (state === undefined) {
      return res.status(400).json({ error: 'Missing state payload.' });
    }

    try {
      // Exclude session token from database state to prevent leakage
      const sanitizedState = { ...state };
      delete sanitizedState.userSession;

      await usersCollection.updateOne(
        { _id: userId },
        { 
          $set: { 
            appState: sanitizedState, 
            updatedAt: new Date() 
          } 
        }
      );
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error saving state:', error);
      return res.status(500).json({ error: 'Database error saving state.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
};
