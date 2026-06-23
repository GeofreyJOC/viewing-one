const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Agent = require('../models/Agent');

// @route   POST /api/auth/register
// @desc    Register a new agent
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, companyName, phone, website, plan } = req.body;

    // Validation
    if (!name || !email || !password || !companyName) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, and company name are required'
      });
    }

    // Check if agent already exists
    const existingAgent = await Agent.findOne({ email: email.toLowerCase() });
    if (existingAgent) {
      return res.status(400).json({
        success: false,
        message: 'An agent with this email already exists'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create agent
    const agent = new Agent({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      companyName,
      phone,
      website,
      plan: plan || 'starter'
    });

    // Save agent
    await agent.save();

    // Create JWT token
    const token = jwt.sign(
      { id: agent._id, email: agent.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Return response
    res.status(201).json({
      success: true,
      message: 'Agent registered successfully',
      token,
      agent: {
        id: agent._id,
        name: agent.name,
        email: agent.email,
        companyName: agent.companyName,
        slug: agent.slug,
        plan: agent.plan,
        url: `viewing.one/${agent.slug}`,
        dashboardUrl: `viewing.one/dashboard`
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login agent
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find agent
    const agent = await Agent.findOne({ email: email.toLowerCase() }).select('+password');
    if (!agent) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, agent.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Create JWT token
    const token = jwt.sign(
      { id: agent._id, email: agent.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Return response
    res.json({
      success: true,
      message: 'Login successful',
      token,
      agent: {
        id: agent._id,
        name: agent.name,
        email: agent.email,
        companyName: agent.companyName,
        slug: agent.slug,
        plan: agent.plan,
        url: `viewing.one/${agent.slug}`
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current agent
// @access  Private
router.get('/me', async (req, res) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token, authorization denied'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Find agent
    const agent = await Agent.findById(decoded.id);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    // Return agent
    res.json({
      success: true,
      agent: {
        id: agent._id,
        name: agent.name,
        email: agent.email,
        companyName: agent.companyName,
        slug: agent.slug,
        plan: agent.plan,
        primaryColor: agent.primaryColor,
        secondaryColor: agent.secondaryColor,
        template: agent.template,
        url: `viewing.one/${agent.slug}`
      }
    });

  } catch (error) {
    console.error('Get agent error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;