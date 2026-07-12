const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { RoomInvitationStore, RoomInvitationError } = require('../socket');

describe('RoomInvitationStore', () => {
  test('binds an invitation to its recipient and consumes it once', () => {
    const store = new RoomInvitationStore({ now: () => 1_000 });
    const invitation = store.create({
      inviterId: 'user-a',
      inviterSocketId: 'socket-a',
      recipientId: 'user-b',
      subject: 'math',
    });

    assert.throws(
      () => store.consume(invitation.invitationId, 'user-c'),
      (error) => error instanceof RoomInvitationError && error.code === 'INVITATION_FORBIDDEN'
    );
    assert.equal(store.consume(invitation.invitationId, 'user-b').subject, 'math');
    assert.throws(
      () => store.consume(invitation.invitationId, 'user-b'),
      (error) => error.code === 'INVITATION_NOT_FOUND'
    );
  });

  test('rejects expired invitations', () => {
    let now = 1_000;
    const store = new RoomInvitationStore({ ttlMs: 60_000, now: () => now });
    const invitation = store.create({
      inviterId: 'user-a',
      inviterSocketId: 'socket-a',
      recipientId: 'user-b',
      subject: 'math',
    });
    now = 61_001;

    assert.throws(
      () => store.consume(invitation.invitationId, 'user-b'),
      (error) => error.code === 'INVITATION_EXPIRED'
    );
  });
});