module.exports = async (req, res) => {
  try {
    // Return only the public client configuration to the frontend
    return res.status(200).json({
      googleClientId: process.env.GOOGLE_CLIENT_ID || ''
    });
  } catch (error) {
    console.error('Config API error:', error);
    return res.status(500).json({ error: 'Failed to retrieve configuration settings.' });
  }
};
