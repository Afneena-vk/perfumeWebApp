const mongoose = require("mongoose");
const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Brand = require("../../models/brandSchema");
const Wishlist = require("../../models/wishlistSchema");


const getWishlist = async (req, res) => {
  try {
    
    const user = req.session.user || req.user;

    if (!user) {
      return res.status(401).json({ message: "User not authenticated." });
    }

    const userId = user._id; 
   
   
    const wishlist = await Wishlist.findOne({ userId })
      .populate("products.productId") 
      .exec();

    if (!wishlist) {
     
      return res.render("wishlist", { products: [] });
    }
    const userData = await User.findOne({ _id: user._id });
   
    const products = wishlist.products.map(item => item.productId);

    
    res.locals.user = userData;
    res.render("wishlist", { products });
  } catch (error) {
    console.error("Error fetching wishlist:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};


const toggleWishlist = async (req, res) => {
  try {
   
    const user = req.session.user || req.user;

    if (!user) {
      return res.status(401).json({ message: "User not authenticated." });
    }

    const userId = user._id; 
    const productId = req.query.id; 

    console.log("Request Query:", req.query);

    if (!productId) {
      return res.status(400).json({ message: "Product ID is required." });
    }
    console.log("Received Product ID:", productId);

   
    const wishlistItem = await Wishlist.findOne({ userId, "products.productId": productId });

    if (wishlistItem) {
     
      await Wishlist.updateOne(
        { userId, "products.productId": productId },
        { $pull: { products: { productId } } }
      );
      return res.status(200).json({ message: "Removed from wishlist." });
    } else {
     
      await Wishlist.updateOne(
        { userId },
        { 
          $push: { 
            products: { 
              productId, 
              size: req.query.size || 'default', 
              addedOn: new Date() 
            }
          }
        },
        { upsert: true } 
      );
      return res.status(201).json({ message: "Added to wishlist." });
    }
  } catch (error) {
    console.error("Error toggling wishlist:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};


const deleteProductFromWishlist = async (req, res) => {
  try {

    const user = req.session.user || req.user;

    if (!user) {
      return res.status(401).json({ message: "User not authenticated." });
    }

    const userId = user._id; 
  
    const productId = req.params.productId; 
    console.log("Removing productId:", productId, "for userId:", userId);

    const result = await Wishlist.findOneAndUpdate(
      { userId: userId }, 
      { $pull: { products: { productId: productId } } },
      { new: true } 
    );

    if (!result) {
      return res.status(404).json({ message: 'Wishlist not found for this user' });
    }

    res.status(200).json({ message: 'Product removed from wishlist' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};



  module.exports ={
    getWishlist,
   toggleWishlist,
   deleteProductFromWishlist,
}