const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true
  },

  amount: {
    type: Number,
    required: true
  },

  mpesaReceiptNumber: {
    type: String,
    required: true
  },

  transactionDate: {
    type: Number,
    required: true
  },

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  cart: {
    type: Array,
    default: []
  }

}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
