const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const matchmaking = require('../services/matchmaking');
const { MatchmakingService, MatchmakingError, QUICK_MATCH_SUBJECT } = matchmaking;

function user(userId, skillLevel, goal = 'practice') {
  return {
    userId,
    username: userId,
    skillLevel,
    goal,
    reputation: 5,
  };
}

function createHarness(initialNow = 1_000_000) {
  let currentTime = initialNow;
  const timers = new Set();
  const service = new MatchmakingService({
    now: () => currentTime,
    setTimer: (callback, delay) => {
      const timer = { callback, delay };
      timers.add(timer);
      return timer;
    },
    clearTimer: (timer) => timers.delete(timer),
  });
  service._saveSessionToDB = async () => {};
  service._endSessionInDB = async () => {};
  service._persistConnectionStateInDB = async () => {};
  service._creditRoomStudyTime = async () => {};
  service._handleRoomClosure = async () => {};
  return {
    service,
    setNow: (value) => { currentTime = value; },
    timers,
  };
}

describe('MatchmakingService', () => {
  test('matches compatible users behind an incompatible queue head', () => {
    const { service, setNow } = createHarness();
    service.addToQueue('math', 'socket-a', user('user-a', 'beginner', 'practice'));
    setNow(1_000_100);
    service.addToQueue('math', 'socket-b', user('user-b', 'advanced', 'discuss'));
    setNow(1_000_200);
    const match = service.addToQueue('math', 'socket-c', user('user-c', 'advanced', 'discuss'));

    assert.ok(match);
    assert.deepEqual(
      [match.user1.user.userId, match.user2.user.userId],
      ['user-b', 'user-c']
    );
    assert.deepEqual(
      service.queues.get('math').map((entry) => entry.user.userId),
      ['user-a']
    );
  });

  test('exports and accepts the dedicated quick-match subject', () => {
    const { service } = createHarness();

    assert.equal(QUICK_MATCH_SUBJECT, '__quick__');
    assert.doesNotThrow(() => {
      service.addToQueue(QUICK_MATCH_SUBJECT, 'socket-a', user('user-a', 'any', 'any'));
    });
  });

  test('rejects unsupported subject and preference values', () => {
    const { service } = createHarness();

    assert.throws(
      () => service.addToQueue('__proto__', 'socket-a', user('user-a', 'any', 'any')),
      (error) => error instanceof MatchmakingError && error.code === 'INVALID_SUBJECT'
    );
    assert.throws(
      () => service.addToQueue('math', 'socket-a', user('user-a', 'expert', 'any')),
      (error) => error instanceof MatchmakingError && error.code === 'INVALID_SKILL'
    );
  });

  test('treats any preference as a wildcard without waiting', () => {
    const { service } = createHarness();
    service.addToQueue('math', 'socket-a', user('user-a', 'beginner', 'practice'));

    const match = service.addToQueue('math', 'socket-b', user('user-b', 'any', 'any'));

    assert.ok(match);
  });

  test('requires both users to reach each relaxation level', () => {
    const { service, setNow } = createHarness();
    service.addToQueue('math', 'socket-a', user('user-a', 'beginner', 'practice'));
    setNow(1_121_000);

    const earlyMatch = service.addToQueue('math', 'socket-b', user('user-b', 'advanced', 'discuss'));

    assert.equal(earlyMatch, null);
    setNow(1_241_001);
    assert.ok(service.tryMatch('math'));
  });

  test('moves a duplicate user to the newest queue and socket', () => {
    const { service, timers } = createHarness();
    service.addToQueue('math', 'socket-old', user('user-a', 'any', 'any'));
    service.addToQueue('physics', 'socket-new', user('user-a', 'any', 'any'));

    assert.deepEqual(service.getQueueStats(), { physics: 1 });
    assert.equal(service.queueEntriesBySocket.has('socket-old'), false);
    assert.equal(service.queueEntriesBySocket.get('socket-new').subjectId, 'physics');
    assert.equal(timers.size, 2);
  });

  test('bounds queue growth per subject', () => {
    const service = new MatchmakingService({
      maxQueueSizePerSubject: 1,
      setTimer: () => ({}),
      clearTimer: () => {},
    });
    service.addToQueue('math', 'socket-a', user('user-a', 'any', 'any'));

    assert.throws(
      () => service.addToQueue('math', 'socket-b', user('user-b', 'any', 'any')),
      (error) => error.code === 'QUEUE_FULL'
    );
  });

  test('preserves room participants across disconnect and reconnect', () => {
    const { service } = createHarness();
    const { roomId } = service.createDirectRoom(
      'math',
      { socketId: 'socket-a', user: user('user-a', 'any', 'any') },
      { socketId: 'socket-b', user: user('user-b', 'any', 'any') }
    );

    try {
      const disconnected = service.removeUserFromRoom('socket-a');
      assert.equal(disconnected.leavingUser.connected, false);
      assert.equal(service.getRoom(roomId).users.length, 2);

      const reconnected = service.reconnectUser(roomId, 'user-a', 'socket-a-new');
      assert.ok(reconnected);
      assert.equal(reconnected.participant.connected, true);
      assert.equal(reconnected.participant.socketId, 'socket-a-new');
      assert.equal(service.disconnectTimers[roomId], undefined);
    } finally {
      service._clearDisconnectTimer(roomId);
    }
  });

  test('dequeues direct-room participants by user across sockets', () => {
    const { service } = createHarness();
    service.addToQueue('physics', 'socket-a-old', user('user-a', 'any', 'any'));

    service.createDirectRoom(
      'math',
      { socketId: 'socket-a-new', user: user('user-a', 'any', 'any') },
      { socketId: 'socket-b', user: user('user-b', 'any', 'any') }
    );

    assert.deepEqual(service.getQueueStats(), {});
    assert.equal(service.queueEntriesByUser.has('user-a'), false);
    assert.equal(service.activeRoomByUser.has('user-a'), true);
  });

  test('closes and credits a matched room at the shortest finite session limit', async () => {
    const { service, timers } = createHarness();
    const creditedRooms = [];
    service._creditRoomStudyTime = async (room) => { creditedRooms.push(room.id); };
    service.addToQueue('math', 'socket-a', user('user-a', 'any', 'any'));
    const match = service.addToQueue('math', 'socket-b', user('user-b', 'any', 'any'));
    let event;
    service.on('room:time_limit_reached', (data) => { event = data; });

    service.setSessionTimeLimit(match.roomId, [30, null]);
    const timer = [...timers].find((candidate) => candidate.delay === 30 * 60 * 1000);
    assert.ok(timer);
    await timer.callback();

    assert.equal(service.getRoom(match.roomId), null);
    assert.equal(event.limitMinutes, 30);
    assert.deepEqual(creditedRooms, [match.roomId]);
  });
});
