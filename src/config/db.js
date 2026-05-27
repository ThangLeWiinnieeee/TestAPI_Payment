'use strict';

const mongoose = require('mongoose');
const { MONGODB_URI } = require('./index');

/**
 * Kết nối tới MongoDB.
 * Gọi một lần khi server khởi động trong server.js.
 */
async function connectDB() {
  mongoose.connection.on('connected', () => {
    const safeUri = MONGODB_URI.replace(/:([^@]+)@/, ':****@');
    console.log(`MongoDB connected → ${safeUri}`);
  });
  mongoose.connection.on('error', (err) => {
    console.error('MongoDB error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
  });

  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
}

module.exports = { connectDB };
