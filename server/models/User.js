import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, index: true, unique: true, sparse: true },
  googleId: { type: String, index: true },
  facebookId: { type: String, index: true },

  encryptedUserKey: { type: String, required: true },
  gematriaIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Gematria' }],

  isLifetime: { type: Boolean, default: false },

  photoUrl: { type: String, default: '' },
  bio:      { type: String, default: '' },

  // NEW
  role:     { type: String, enum: ['admin','user'], default: 'user', index: true },
  isBanned: { type: Boolean, default: false, index: true },
}, { timestamps: true, strict: true });

UserSchema.virtual('isAdmin').get(function () { return this.role === 'admin'; });
UserSchema.virtual('hasPaid').get(function () { return !!this.isLifetime; });

// First-ever user becomes admin
UserSchema.pre('save', async function (next) {
  if (!this.isNew) return next();
  try {
    const count = await mongoose.model('User').countDocuments({});
    if (count === 0) this.role = 'admin';
    next();
  } catch (e) { next(e); }
});

export default mongoose.model('User', UserSchema);


