// server/models/Gematria.js
import mongoose from 'mongoose';
const { Schema } = mongoose;

const letters = {};
for(let c = 0; c < 26; c++) {
  const letter = String.fromCharCode(97 + c); // a..z
  letters[letter] = { type: Number, required: true };
}

const GematriaSchema = new Schema({
  name: { type: String, required: true },
  // fields a..z
  ...letters,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Gematria', GematriaSchema);
