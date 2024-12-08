const mongoose = require("mongoose");
const {Schema} = mongoose;


const cartSchema = new Schema({

    userId :{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    items:[{
        productId:{
            type:Schema.Types.ObjectId,
            ref:'Product',
            required:true
        },
       
        quantity:{
            type:Number,
            required: true,
            default:1,
            min: [1, 'Quantity cannot be less than 1'],
        },
        size: {
            type: String,
            required: true,
          },
        price:{
            type:Number,
            required:true
        },
        totalPrice:{
            type:Number,
            required:true
        },
        

}]

}, { timestamps: true });



const Cart = mongoose.model("Cart",cartSchema);
module.exports = Cart;