const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const config = require('./index');
const User = require('../models/User');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: config.googleClientId,
      clientSecret: config.googleClientSecret,
      callbackURL: config.googleCallbackURL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log('[Passport] Google callback received');
        console.log('[Passport] Profile ID:', profile.id);
        console.log('[Passport] Profile displayName:', profile.displayName);
        console.log('[Passport] Profile emails:', JSON.stringify(profile.emails));

        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          console.log('[Passport] Found existing user by googleId:', user._id);
          return done(null, user);
        }

        const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
        console.log('[Passport] Extracted email:', email);

        if (email) {
          user = await User.findOne({ email });
          if (user) {
            console.log('[Passport] Found existing user by email, linking Google ID');
            user.googleId = profile.id;
            await user.save();
            return done(null, user);
          }
        }

        let displayName = profile.displayName || (email ? email.split('@')[0] : 'User');
        if (displayName.length > 30) {
          displayName = displayName.substring(0, 30);
        }

        console.log('[Passport] Creating new user:', { googleId: profile.id, email, displayName });

        user = await User.create({
          googleId: profile.id,
          email: email,
          displayName: displayName,
          avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : '',
          authProvider: 'google',
          isOnline: true,
        });

        console.log('[Passport] User created successfully:', user._id);
        done(null, user);
      } catch (err) {
        console.error('[Passport] Google auth ERROR:', err.message);
        console.error('[Passport] Error stack:', err.stack);
        done(err);
      }
    }
  )
);

module.exports = passport;
