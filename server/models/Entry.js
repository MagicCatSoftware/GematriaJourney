// server/models/Entry.js
import mongoose from 'mongoose';
const { Schema } = mongoose;

const EntrySchema = new Schema({
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  gematria: { type: Schema.Types.ObjectId, ref: 'Gematria', required: true },
  phrase: { type: String }, // optional plaintext for public entries
  result: { type: Number }, // store plaintext result for public entries
  visibility: { type: String, enum: ['private','public'], default: 'private' },
  // If private: ciphertext contains encrypted JSON { phrase, result, meta... }
  ciphertext: { type: String }, 
  createdAt: { type: Date, default: Date.now },
  master: {
    status: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none'
    },
    submittedAt: { type: Date },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  }
});

export default mongoose.model('Entry', EntrySchema);
