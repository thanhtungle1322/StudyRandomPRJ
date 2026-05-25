/**
 * Migration script: Chạy TRƯỚC KHI deploy code Phase 1 mới
 * 
 * Usage: node scripts/migrateUsers.js
 * 
 * Biến đổi user cũ (chỉ có username) → user mới (có displayName + authProvider)
 * 1. Copy username → displayName
 * 2. Set authProvider = 'local'
 * 3. Set email = "legacy_{userId}@studyrandom.local" (placeholder cho user cũ)
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/studyrandom';

async function migrate() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('[Migration] Connected to MongoDB');

    const db = mongoose.connection.db;
    const users = db.collection('users');

    // 1. Set displayName = username cho user chưa có displayName
    const result1 = await users.updateMany(
      { displayName: { $exists: false } },
      [{ $set: { displayName: '$username' } }]
    );
    console.log(`[Migration] Set displayName = username: ${result1.modifiedCount} users`);

    // 2. Set authProvider = 'local' cho user chưa có
    const result2 = await users.updateMany(
      { authProvider: { $exists: false } },
      { $set: { authProvider: 'local' } }
    );
    console.log(`[Migration] Set authProvider = 'local': ${result2.modifiedCount} users`);

    // 3. Set placeholder email cho user chưa có email
    const legacyUsers = await users.find({ email: { $exists: false } }).toArray();
    let emailCount = 0;
    for (const user of legacyUsers) {
      await users.updateOne(
        { _id: user._id },
        { $set: { email: `legacy_${user._id}@studyrandom.local` } }
      );
      emailCount++;
    }
    console.log(`[Migration] Set placeholder emails: ${emailCount} users`);

    // 4. Set plan = 'free' cho user chưa có
    const result4 = await users.updateMany(
      { plan: { $exists: false } },
      { $set: { plan: 'free' } }
    );
    console.log(`[Migration] Set plan = 'free': ${result4.modifiedCount} users`);

    console.log('[Migration] Done!');
  } catch (err) {
    console.error('[Migration] Error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

migrate();
