const mongoose = require("mongoose");
const {Schema} = mongoose;


const brandSchema = new Schema({

    brandName : {
        type : String,
        required:true
    },
    brandImage : {
       type : [String],
      required:true
    },
    isBlocked : {
        type : Boolean,
        default:false
    },
    status: { 
        type: String,
        enum: ["active","blocked"], 
        default: "active" 
    },
    createdAt: {
        type:Date,
        default:Date.now
    }

})

const Brand = mongoose.model("Brand",brandSchema);
module.exports = Brand;