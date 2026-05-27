'use strict';

const mongoose = require('mongoose');
const { MONGODB_URI } = require('./index');

/**
 * Kết nối tới MongoDB.
 * Gọi một lần khi server khởi động trong server.js.
 */
async function connectDB() {
  mongoose.connection.on('connected', () => {
    console.log(`MongoDB connected → ${MONGODB_URI}`);
  });
  mongoose.connection.on('error', (err) => {
    console.error('MongoDB error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
  });

  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });
}

module.exports = { connectDB };
