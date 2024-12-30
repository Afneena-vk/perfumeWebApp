const mongoose = require("mongoose");
const {Schema} = mongoose;
const {v4:uuidv4} = require('uuid');

const orderSchema = new Schema({

    orderId : {
        type:String,
        
        default: () => uuidv4().split('-')[0],
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
        },
        discountApplied: {
          type: Number,
          default: 0
      },
      finalPrice: {
          type: Number,
          required: true
      },
        status: {
          type: String,
          required: true,
          enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Requested', 'Return Approved', 'Return Rejected', 'Returned'],
          default: 'Pending'
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
        type:Date,
        default: Date.now
    },
    status:{
        type:String,
        required:true,
        
        enum:['Pending','Processing','Shipped','Delivered','Cancelled', "Return Requested","Return Approved","Return Rejected",'Returned'],
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
    
   
    coupon: {
      type: Schema.Types.ObjectId,
      ref:'Coupon',
      required:false
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