const { Schema, model } = require('mongoose');

const userSchema = new Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
  },
  { timestamps: true }
);

// Unique index enforces one account per email even when two sign-ups race.
userSchema.index({ email: 1 }, { unique: true });

userSchema.methods.toPublic = function toPublic() {
  return { id: this._id, email: this.email, name: this.name, role: this.role };
};

module.exports = model('User', userSchema);
