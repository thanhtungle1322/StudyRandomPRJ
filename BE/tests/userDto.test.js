const test = require('node:test');
const assert = require('node:assert/strict');
const UserDto = require('../dtos/userDto');

test('authenticated user DTO preserves profile personalization', () => {
  const user = {
    _id: { toString: () => 'user-a' },
    displayName: 'Student A',
    email: 'student@example.com',
    nickname: 'Study buddy',
    bio: 'Learning every day',
    interests: ['Math'],
    themeColor: '#123456',
    themeGradient: 'linear-gradient(#123456, #654321)',
    banner: 'data:image/jpeg;base64,banner-data',
    badges: [],
  };

  const result = UserDto.toSelf(user);

  assert.equal(result.nickname, user.nickname);
  assert.equal(result.bio, user.bio);
  assert.deepEqual(result.interests, user.interests);
  assert.equal(result.themeColor, user.themeColor);
  assert.equal(result.themeGradient, user.themeGradient);
  assert.equal(result.banner, user.banner);
});