require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const connectDB = require('../config/database');

async function createAdmin() {
  try {
    // Connect to database
    await connectDB();

    const args = process.argv.slice(2);
    const username = args[0] || 'admin';
    const email = args[1] || 'admin@example.com';
    const password = args[2] || 'admin123';

    // Check if admin already exists
    const existingAdmin = await User.findOne({ 
      $or: [{ username }, { email }, { role: 'admin' }] 
    });

    if (existingAdmin) {
      console.log('Admin user already exists!');
      console.log('Username:', existingAdmin.username);
      console.log('Email:', existingAdmin.email);
      console.log('Role:', existingAdmin.role);
      process.exit(0);
    }

    // Create admin user
    const admin = new User({
      username,
      email,
      password,
      role: 'admin'
    });

    await admin.save();

    console.log('Admin user created successfully!');
    console.log('Username:', username);
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('Role: admin');
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  }
}

createAdmin();

