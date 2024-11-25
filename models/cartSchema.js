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
        price:{
            type:Number,
            required:true
        },
        totalPrice:{
            type:Number,
            required:true
        },
        status:{
            type :String,
            enum: ['placed', 'canceled', 'pending'],
            default:'placed'
        },
        cancellationReason:{
            type:String,
            default:"none"
        }

}]

})

// // Virtual to calculate totalPrice for each item
// cartSchema.virtual('items.totalPrice').get(function () {
//     return this.quantity * this.price;
//   });
  
//   // Virtual for the entire cart's total price
//   cartSchema.virtual('cartTotalPrice').get(function () {
//     return this.items.reduce((acc, item) => acc + item.quantity * item.price, 0);
//   });

//   cartSchema.pre('save', function (next) {
//     this.items.forEach((item) => {
//       item.totalPrice = item.quantity * item.price;
//     });
//     next();
//   });
  
//   // Include virtuals in JSON output
//   cartSchema.set('toJSON', { virtuals: true });
//   cartSchema.set('toObject', { virtuals: true });
  
// cartSchema.pre('save', async function (next) {
//     for (let item of this.items) {
//         const product = await Product.findById(item.productId);
//         if (product && item.quantity > product.quantity) {
//             throw new Error(`Cannot add more than available stock for product ${product.productName}`);
//         }
//     }
//     next();
// });


const Cart = mongoose.model("Cart",cartSchema);
module.exports = Cart;