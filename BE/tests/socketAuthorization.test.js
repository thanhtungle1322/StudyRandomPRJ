const { afterEach, describe, test } = require('node:test');
const assert = require('node:assert/strict');
const matchmaking = require('../services/matchmaking');
const {
  getAuthorizedRoom,
  reserveMatchQuotas,
  getLiveInvitationSockets,
  trackPendingSocket,
  disconnectUserSockets,
  isUserRevoked,
} = require('../socket');

const roomId = 'authorization-test-room';

function socket(userId, socketId, joined = false) {
  return {
    id: socketId,
    userId,
    rooms: new Set(joined ? [socketId, roomId] : [socketId]),
  };
}

describe('socket room authorization', () => {
  afterEach(() => {
    matchmaking._closeRoom(roomId);
  });

  test('allows only an initial participant to join', () => {
    matchmaking._registerRoom({
      id: roomId,
      initialUsers: ['user-a', 'user-b'],
      users: [
        { socketId: 'socket-a', user: { userId: 'user-a' } },
        { socketId: 'socket-b', user: { userId: 'user-b' } },
      ],
    });

    assert.ok(getAuthorizedRoom(socket('user-a', 'socket-a'), roomId));
    assert.equal(getAuthorizedRoom(socket('outsider', 'socket-x'), roomId), null);
  });

  test('rejects stale and non-joined sockets for room events', () => {
    matchmaking._registerRoom({
      id: roomId,
      initialUsers: ['user-a', 'user-b'],
      users: [
        { socketId: 'socket-a-current', user: { userId: 'user-a' } },
        { socketId: 'socket-b', user: { userId: 'user-b' } },
      ],
    });

    assert.ok(getAuthorizedRoom(socket('user-a', 'socket-a-current', true), roomId, true));
    assert.equal(getAuthorizedRoom(socket('user-a', 'socket-a-stale', true), roomId, true), null);
    assert.equal(getAuthorizedRoom(socket('user-a', 'socket-a-current'), roomId, true), null);
  });
});

describe('match quota reservation', () => {
  test('refunds successful claims when a peer claim throws', async () => {
    const refunded = [];
    const quotaService = {
      async consumeMatchQuota(userId) {
        if (userId === 'user-b') throw new Error('database unavailable');
        return { allowed: true, consumed: true, limits: { dailyMatches: 3, sessionMinutes: 30 } };
      },
      async refundMatchQuota(userId) {
        refunded.push(userId);
      },
    };

    const result = await reserveMatchQuotas(quotaService, ['user-a', 'user-b']);

    assert.equal(result.allowed, false);
    assert.equal(result.failureIndex, 1);
    assert.deepEqual(refunded, ['user-a']);
  });
});

describe('socket lifecycle guards', () => {
  test('rejects an invitation when either socket is no longer live', () => {
    const inviter = { id: 'socket-a', connected: true };
    const accepter = { id: 'socket-b', connected: true };
    const io = { sockets: { sockets: new Map([[inviter.id, inviter], [accepter.id, accepter]]) } };

    assert.deepEqual(getLiveInvitationSockets(io, inviter.id, accepter), {
      inviterSocket: inviter,
      accepterSocket: accepter,
    });
    inviter.connected = false;
    assert.equal(getLiveInvitationSockets(io, inviter.id, accepter), null);
  });

  test('marks a pending handshake revoked before connection registration', () => {
    const pendingSocket = { data: {} };
    trackPendingSocket('revoked-user', pendingSocket);

    const disconnected = disconnectUserSockets('revoked-user');

    assert.equal(disconnected, 1);
    assert.equal(pendingSocket.data.accountRevoked, true);
    assert.equal(isUserRevoked('revoked-user'), true);
  });
});