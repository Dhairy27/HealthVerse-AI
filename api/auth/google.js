const jwt = require('jsonwebtoken');
const { connectToDatabase } = require('../lib/db');

module.exports = async (req, res) => {
  // Allow only POST requests
  if (req.method !== 'POST') {
    return res.status(451).json({ error: 'Method not allowed. Use POST.' });
  }

  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ error: 'Missing credential parameter.' });
  }

  try {
    // 1. Verify Google token using Google's public tokeninfo endpoint
    const googleVerifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
    const verifyResponse = await fetch(googleVerifyUrl);

    if (!verifyResponse.ok) {
      const errorText = await verifyResponse.text();
      console.error('Google token verification failed:', errorText);
      return res.status(401).json({ error: 'Invalid Google ID token.' });
    }

    const payload = await verifyResponse.json();

    // 2. Validate token audience matches our Client ID
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ error: 'Server misconfiguration: Client ID is missing.' });
    }

    if (payload.aud !== clientId) {
      console.error(`Audience mismatch: expected ${clientId}, got ${payload.aud}`);
      return res.status(401).json({ error: 'Token client ID audience mismatch.' });
    }

    // 3. Connect to database
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');

    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name;
    const picture = payload.picture;

    // 4. Find or Create User
    let user = await usersCollection.findOne({ 
      $or: [{ googleId: googleId }, { email: email }] 
    });

    if (!user) {
      // Create new user in the database
      const newUser = {
        googleId,
        email,
        name,
        picture,
        createdAt: new Date(),
        updatedAt: new Date(),
        appState: null
      };
      
      const insertResult = await usersCollection.insertOne(newUser);
      user = { _id: insertResult.insertedId, ...newUser };
    } else {
      // Update existing user details if changed
      await usersCollection.updateOne(
        { _id: user._id },
        { 
          $set: { 
            name, 
            picture, 
            googleId, // ensure googleId is set
            updatedAt: new Date() 
          } 
        }
      );
      user.name = name;
      user.picture = picture;
    }

    // 5. Generate JWT session token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({ error: 'Server misconfiguration: JWT Secret is missing.' });
    }

    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // 6. Return response
    return res.status(200).json({
      token,
      user: {
        name: user.name,
        email: user.email,
        picture: user.picture
      },
      state: user.appState
    });

  } catch (error) {
    console.error('Google Auth Handler error:', error);
    return res.status(500).json({ error: 'Internal Server Error during Google Auth verification.' });
  }
};
