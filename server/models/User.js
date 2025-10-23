// server/models/User.js
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, index: true, unique: true, sparse: true },
  googleId: { type: String, index: true },
  facebookId: { type: String, index: true },

  encryptedUserKey: { type: String, required: true }, // your per-user key blob
  gematriaIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Gematria' }],

  isLifetime: { type: Boolean, default: false },

  // ✅ make sure these exist
  photoUrl: { type: String, default: '' },
  bio:      { type: String, default: '' },
}, { timestamps: true, strict: true });

export default mongoose.model('User', UserSchema);
