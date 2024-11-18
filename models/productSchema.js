const mongoose = require("mongoose");
const {Schema} = mongoose;

const productSchema = new Schema({
  productName : {
        type: String,
        required:true,
  },
  description: {
        type : String,
        required:true,
  },
  brand: {
        type: String,
        required:true,
  },
  category: {
    type:Schema.Types.ObjectId,
    ref:"Category",
    required:true,
},
regularPrice:{
    type:Number,
    required:true,
},
salePrice:{
    type:Number,
    required:true
},
productOffer : {
    type:Number,
    default:0,
},
quantity:{
    type:Number,
    default:true
},
size:{
    type:[String],
    required:true,

},
productImage:{
    type:[String],
    required:true
},
isBlocked:{
    type:Boolean,
    default:false
},
isDeleted: { 
    type: Boolean,
    default: false,
  },
status:{
    type:String,
    enum:["Available","out of stock","Discontinued"],
    required:true,
    default:"Available"
},

ratings: {
    type: [Number], 
    default: [], 
  },
  reviews: [{
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    comment: String,
    rating: Number, 
    createdAt: { type: Date, default: Date.now }
  }],
  highlights: {
    type: [String], 
    default: []
  },
  coupons: {
    type: [String], 
    default: []
  },

createdOn: {
    type: Date,
    default: Date.now, 
  },


},{timestamps:true});

const Product = mongoose.model("Product",productSchema);

module.exports = Product;