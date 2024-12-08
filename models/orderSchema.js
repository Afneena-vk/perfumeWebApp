const mongoose = require("mongoose");
const {Schema} = mongoose;
const {v4:uuidv4} = require('uuid');

const orderSchema = new Schema({

    orderId : {
        type:String,
        default:()=>uuidv4(),
        unique:true
    },
    userId: {  
        type: Schema.Types.ObjectId,
        ref: 'User',  
        required: true
    },
    orderedItems:[{

        product:{
            type:Schema.Types.ObjectId,
            ref:'Product',
            required:true
        },
        size: {
            type: String,
            required: true,
          },
        quantity:{
            type:Number,
            required:true
        },
        price:{
            type:Number,
            default:0
        }

    }],
    

    totalPrice:{
        type:Number,
        required:true
    },
    discount:{
        type:Number,
        default:0
    },
    finalAmount:{
        type:Number,
        required:true
    },
    
    address: {
        addressType: String,
        name: String,
        city: String,
        landMark: String,
        state: String,
        pincode: Number,
        phone: String,
      },
    invoiceDate:{
        type:Date
    },
    status:{
        type:String,
        required:true,
        enum:['Pending','Processing','Shipped','Delivered','Cancelled','Return Request','Returned'],
        default: "Pending",   
    },
    date: {
        type: Date,
        default: Date.now,
        required: false
      },
    
    payment: [{
        method: {
          type: String,
          required: true,
          enum: ["COD", "Online Payment", "Wallet Payment"]
        },
        status: {
          type: String,
          required: true,
          enum: ["pending", "completed",'Failed','Refunded']
        },
        razorpayOrderId: {
          type: String,
          required: false  
        }
      }],
    // createdOn :{
    //     type:Date,
    //     default:Date.now,
    //     required:true
    // },
    couponApplied:{
        type:Boolean,
        default:false
    },
    shippingMethod: {
        type: String,
        enum: ["Standard", "Express", "Free Shipping"]
      },
    trackingNumber: {
        type: String
      },
      cancelReason: {
        type: String
      },
})

const Order = mongoose.model("Order",orderSchema);
module.exports = Order;