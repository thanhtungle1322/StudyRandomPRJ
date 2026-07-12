const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const userService = require('../services/userService');

const { UserService } = userService;

function createStudyHarness() {
  const sessions = new Map([
    ['room-a', {
      _id: 'session-a',
      roomId: 'room-a',
      users: [{ userId: 'user-a', joinedAt: new Date('2026-07-10T00:00:00.000Z') }],
    }],
    ['room-b', {
      _id: 'session-b',
      roomId: 'room-b',
      users: [{ userId: 'user-a', joinedAt: new Date('2026-07-10T00:05:00.000Z') }],
    }],
  ]);
  const user = { totalStudyMinutes: 0, streak: 0, badges: [] };
  const pipelines = [];

  const SessionModel = {
    async findOne({ roomId }) {
      return sessions.get(roomId) || null;
    },
    async updateOne(query, update) {
      const session = [...sessions.values()].find((entry) => entry._id === query._id);
      if (!session) return { matchedCount: 0 };
      const participant = session.users[0];
      if (update.$set?.['users.$.studyCreditedAt']) {
        if (participant.studyCreditedAt) return { matchedCount: 0 };
        participant.studyCreditedAt = update.$set['users.$.studyCreditedAt'];
        participant.studyCreditedMinutes = update.$set['users.$.studyCreditedMinutes'];
      }
      if (update.$unset) {
        delete participant.studyCreditedAt;
        delete participant.studyCreditedMinutes;
      }
      return { matchedCount: 1 };
    },
  };
  const UserModel = {
    async findOneAndUpdate(query, pipeline) {
      assert.equal(query._id, 'user-a');
      pipelines.push(pipeline);
      const minutes = pipeline[0].$set.totalStudyMinutes.$add[1];
      user.totalStudyMinutes += minutes;
      user.streak = Math.max(1, user.streak);
      user.badges = ['FIRST_STEP'];
      return { ...user };
    },
  };

  return {
    service: new UserService({
      UserModel,
      SessionModel,
      now: () => new Date('2026-07-10T00:12:00.000Z'),
    }),
    sessions,
    user,
    pipelines,
  };
}

describe('UserService study credit', () => {
  test('atomically accumulates separate session credits and keeps each session idempotent', async () => {
    const harness = createStudyHarness();
    const first = await harness.service.updateStudyTime('user-a', 'room-a');
    const second = await harness.service.updateStudyTime('user-a', 'room-b');
    const repeated = await harness.service.updateStudyTime('user-a', 'room-a');

    assert.equal(first.creditedMinutes, 12);
    assert.equal(second.creditedMinutes, 7);
    assert.equal(harness.user.totalStudyMinutes, 19);
    assert.equal(harness.pipelines.length, 2);
    assert.equal(repeated.alreadyCredited, true);
    assert.equal(repeated.creditedMinutes, 12);
  });
});
