const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Can be null for anonymous requests
  },
  pixels: {
    type: Map,
    of: Boolean,
    required: true
  },
  imageData: {
    type: String, // Base64 image data
    required: false
  },
  imagePosition: {
    pixels: [Number],
    imageData: String
  },
  link: {
    type: String,
    required: false
  },
  text: {
    type: String,
    required: false
  },
  email: {
    type: String,
    required: false
  },
  telegram: {
    type: String,
    required: false
  },
  price: {
    type: Number,
    required: false
  },
  pixelCount: {
    type: Number,
    required: false
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'rejected'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update updatedAt on save
requestSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Helper function to convert pixels Map to Object
function pixelsMapToObject(pixelsMap) {
  if (!pixelsMap) return {};
  if (pixelsMap instanceof Map) {
    const pixelsObj = {};
    pixelsMap.forEach((value, key) => {
      pixelsObj[key] = value;
    });
    return pixelsObj;
  }
  return pixelsMap || {};
}

// Convert pixels Map to Object for JSON serialization
requestSchema.methods.toJSON = function() {
  const obj = this.toObject();
  obj.pixels = pixelsMapToObject(this.pixels);
  obj.id = obj._id.toString();
  delete obj._id;
  delete obj.__v;
  return obj;
};

const Request = mongoose.model('Request', requestSchema);

// Export both the model and helper function
module.exports = Request;
module.exports.pixelsMapToObject = pixelsMapToObject;

