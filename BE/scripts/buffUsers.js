/**
 * Script to buff user study times and streaks in the database.
 * Usage: node scripts/buffUsers.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/studyrandom';
const User = require('../models/User');

async function buffUsers() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('[Buff Script] Connected to MongoDB');

    // Find users with totalStudyMinutes < 3 OR streak < 2 (or if fields are missing)
    const query = {
      $or: [
        { totalStudyMinutes: { $lt: 3 } },
        { streak: { $lt: 2 } },
        { totalStudyMinutes: { $exists: false } },
        { streak: { $exists: false } }
      ]
    };

    const usersToBuff = await User.find(query);
    console.log(`[Buff Script] Found ${usersToBuff.length} users to buff.`);

    if (usersToBuff.length === 0) {
      console.log('[Buff Script] No users match the criteria.');
      return;
    }

    const bulkOps = [];

    for (const user of usersToBuff) {
      // random 10-25 mins
      const randomMinutes = Math.floor(Math.random() * (25 - 10 + 1)) + 10;
      // random 2-7 streak
      const randomStreak = Math.floor(Math.random() * (7 - 2 + 1)) + 2;

      // Update badges accordingly
      const badges = user.badges || [];
      const newBadges = new Set(badges);
      if (randomMinutes > 0 && !newBadges.has('FIRST_STEP')) {
        newBadges.add('FIRST_STEP');
      }
      if (randomStreak >= 7 && !newBadges.has('WEEK_STREAK')) {
        newBadges.add('WEEK_STREAK');
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: user._id },
          update: {
            $set: {
              totalStudyMinutes: randomMinutes,
              streak: randomStreak,
              badges: Array.from(newBadges)
            }
          }
        }
      });
    }

    if (bulkOps.length > 0) {
      console.log(`[Buff Script] Executing bulk write for ${bulkOps.length} users...`);
      const result = await User.bulkWrite(bulkOps);
      console.log(`[Buff Script] Successfully modified ${result.modifiedCount} users.`);
    }

  } catch (error) {
    console.error('[Buff Script] Error during buffing:', error);
  } finally {
    await mongoose.disconnect();
    console.log('[Buff Script] Disconnected from MongoDB');
    process.exit(0);
  }
}

buffUsers();
