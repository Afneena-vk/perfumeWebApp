const mongoose = require('mongoose');
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const User = require("../../models/userSchema");

const fs = require("fs");
const path = require("path");
const multer = require("multer");
const sharp = require("sharp");
const { search } = require('../../routes/adminRouter');



const getProductAddPage = async (req,res)=>{
    try {

        const category = await Category.find({isListed:true});
        const brand = await Brand.find({isBlocked:false});
        res.render("product-add",{
            cat:category,
            brand:brand,

        });
        
    } catch (error) {
         console.error("Error loading product add page:", error);
        res.redirect("/pageerror")
    }
};


const addProducts = async (req, res) => {
    try {
        const products = req.body;
        console.log("Request files:", req.files);

       
        const productExists = await Product.findOne({ productName: products.productName });
        if (productExists) {
            return res.status(400).json("Product already exists, please try with another name");
        }

        
        const images = [];
        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                const originalImagePath = req.files[i].path;
                const resizedImagePath = path.join("public", "uploads", "product-images", req.files[i].filename);

                await sharp(originalImagePath)
                    .resize({ width: 440, height: 440 })
                    .toFile(resizedImagePath);
                images.push(req.files[i].filename);
            }
        } else {
            console.log("No files found in req.files");
        }

        console.log("Images array after processing:", images);

        
        const categoryId = await Category.findOne({ name: products.category });
        if (!categoryId) {
            return res.status(400).json("Invalid category name");
        }

        const brandId = await Brand.findOne({ brandName: products.brand });
      if (!brandId) {
        return res.status(400).json("Invalid brand name");
      }
      const sizes = products.sizes.map((size, index) => ({
        size: size,
        quantity: products.quantities[index],
      }));

      console.log("the products size is",sizes);

      if (sizes.length === 0) {
        console.error("Sizes array is empty. Cannot save product.");
        return res.status(400).json({ error: "Sizes are required." });
    }


        const newProduct = new Product({
            productName: products.productName,
            description: products.description,
            brand: brandId._id,
            category: categoryId._id,
            regularPrice: products.regularPrice,
            salePrice: products.salePrice,
            createdOn: new Date(),
            sizes: sizes,
            color: products.color,
            productImage: images,
            status:"Available",
        });

        try {
          await newProduct.save();
          console.log("Product saved successfully:", newProduct);
      } catch (error) {
          console.error("Error saving product:", error);
          return res.status(500).json({ message: "Error saving product" });
      }

       

        return res.redirect("/admin/products");
    } catch (error) {
        console.error("Error in addProducts:", error);
        res.status(500).json({ message: "internal server error" });
    }
};



const getAllProducts = async (req, res) => {
    try {
      const search = req.query.search || "";
      const page = req.query.page || 1;
      const limit = 4;
  
      const productData = await Product.find({
        productName: { $regex: new RegExp(".*" + search + ".*", "i") },
      })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .populate("category")
        .populate("brand","brandName")
        .exec();
  
      const count = await Product.find({
        productName: { $regex: new RegExp(".*" + search + ".*", "i") },
      }).countDocuments();
  
      const category = await Category.find({ isListed: true });
      const brand = await Brand.find({ isBlocked: false });
  
      if (category && brand) {
        res.render("products", {
          data: productData,
          currentPage: page,
          totalPages: Math.ceil(count / limit),
          cat: category,
          brand: brand,
        });
      } else {
        res.status(400).json("cannot fetch products");
      }
    } catch (error) {
      console.error("an error occured", error);
      res.status(500).json({ message: "internal server error" });
    }
  };



const blockProduct = async (req,res)=>{
    try {
        const id = req.query.id;
        await Product.updateOne({_id:id},{$set:{isBlocked:true}});
        res.redirect("/admin/products")
    } catch (error) {
        res.redirect("/pageerror")
    }
};

const unblockProduct = async (req,res)=>{
    try {
        const id = req.query.id;
        await Product.updateOne({_id:id},{$set:{isBlocked:false}});
        res.redirect("/admin/products")
    } catch (error) {
        res.redirect("/pageerror")
    }
};

const getEditProduct = async (req,res)=>{
    try {
      
       const id = req.query.id;
       const product = await Product.findOne({_id:id});
       const category = await Category.find({});
       const brand = await Brand.find({});
        res.render("edit-product",{
            product:product,
            cat:category,
            brand:brand,
        
        });
    } catch (error) {
        res.redirect("/pageerror");
    }
}


const editProduct = async (req,res)=>{
    try {
        
       const id = req.params.id;
       const product = await Product.findOne({_id:id});
       const data = req.body;
       const existingProduct = await Product.findOne({
         productName:data.productName,
         _id:{$ne:id}
       })

       if(existingProduct){
         return res.status(400).json({error:"Product with this name already exists. Please try with another name"});
       }

       const images = [];

       if(req.files && req.files.length>0){
           for(let i=0;i<req.files.length;i++){
               images.push(req.files[i].filename);
           }
       }

       const brandId = await Brand.findOne({ brandName: data.brand });
    if (!brandId) {
      return res.status(400).json("Invalid brand name");
    }

    const categoryId = await Category.findOne({ name: data.category });
    if (!categoryId) {
      return res.status(400).json("Invalid category name");
    }
    const sizes = data.sizes.map((size, index) => ({
        size: size,
        quantity: data.quantities[index],
      }));

       const updateFields = {
          productName:data.productName,
          description:data.description,
          brand: brandId._id,
          category: categoryId._id,
          regularPrice:data.regularPrice,
          salePrice:data.salePrice,
          sizes:sizes,
          color:data.color,
          
      }

      if(req.files.length>0){
        updateFields.$push = {productImage:{$each:images}};
      }

      await Product.findByIdAndUpdate(id,updateFields,{new:true});
      res.redirect("/admin/products");

    } catch (error) {
        console.error(error);
        res.redirect("/pageerror");
    }
}




const deleteSingleImage = async (req,res)=>{
    try {
        
      const {imageNameToServer,productIdToServer} = req.body;
      const product = await Product.findByIdAndUpdate(productIdToServer,{$pull:{productImage:imageNameToServer}});
      const imagePath = path.join("public","uploads","re-images",imageNameToServer);
      if(fs.existsSync(imagePath)){
        await fs.unlinkSync(imagePath);
        console.log(`Image ${imageNameToServer} deleted successfully`);
      }else{
        console.log(`Image ${imageNameToServer} not found`);
      }
      res.send({status:true});

    } catch (error) {
        
    res.redirect("/pageerror")

    }
}

module.exports = {
    getProductAddPage,
    addProducts,
    getAllProducts,
    blockProduct,
    unblockProduct,
    getEditProduct,
    editProduct,
    deleteSingleImage,
};