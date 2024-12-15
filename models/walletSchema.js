const mongoose = require("mongoose");
const {Schema} = mongoose;

const walletSchema = new Schema({
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    transactions: [
      {
        type: {
          type: String,
          enum: ["CREDIT", "DEBIT"],
          required: true,
        },
        amount: {
          type: Number,
          required: true,
        },
        description: String,
        orderId: {
            type: Schema.Types.ObjectId, 
            ref: "Order",
        },
        date: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  });


  const Wallet = mongoose.model("Wallet",walletSchema);
  module.exports = Wallet;
  