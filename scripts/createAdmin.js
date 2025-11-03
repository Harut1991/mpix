require('dotenv').config();
const { dbPromise } = require('../config/database');
const UserModel = require('../models/User');

async function createAdmin() {
  try {
    // Wait for database to initialize
    await dbPromise;

    const args = process.argv.slice(2);
    const username = args[0] || 'admin';
    const email = args[1] || 'admin@example.com';
    const password = args[2] || 'admin123';

    // Check if admin already exists
    const existingAdminByUsername = UserModel.findUser({ username: username.toLowerCase().trim() });
    const existingAdminByEmail = UserModel.findUser({ email: email.toLowerCase().trim() });
    const existingAdminByRole = UserModel.findUser({ role: 'admin' });

    if (existingAdminByUsername || existingAdminByEmail || existingAdminByRole) {
      console.log('Admin user already exists!');
      if (existingAdminByUsername) {
        console.log('Username:', existingAdminByUsername.username);
        console.log('Email:', existingAdminByUsername.email);
        console.log('Role:', existingAdminByUsername.role);
      } else if (existingAdminByEmail) {
        console.log('Username:', existingAdminByEmail.username);
        console.log('Email:', existingAdminByEmail.email);
        console.log('Role:', existingAdminByEmail.role);
      } else if (existingAdminByRole) {
        console.log('Username:', existingAdminByRole.username);
        console.log('Email:', existingAdminByRole.email);
        console.log('Role:', existingAdminByRole.role);
      }
      process.exit(0);
    }

    // Create admin user
    const admin = await UserModel.createUser({
      username,
      email,
      password,
      role: 'admin'
    });

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
