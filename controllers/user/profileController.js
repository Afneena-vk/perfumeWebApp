
const mongoose = require("mongoose");
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Address = require("../../models/addressSchema");

// const userProfile = async (req,res) =>{
//     try {
        
//        const userId = req.session.user || req.user;
//        const userData = await User.findById(userId);
 
//        const orders = await Order.find({ userId: userId });

//        res.render('profile',{
//         user:userData,
//         orders: orders
//        })
//     } catch (error) {
//         console.error("Error for retrieve profile data",error);
//         res.redirect("/pageNotFound")
//     }
// }

const userProfile = async (req,res) =>{

    const userSession = req.session.user || req.user;

    if (!userSession || !userSession._id) {
        return res.status(401).send("Unauthorized: No user session found");
    }

    try {
        
     
       const user = await User.findById(userSession._id);
       const orders = await Order.find({ userId:userSession._id });

       res.render('profile',{
        user:user,
        orders: orders
       })
    } catch (error) {
        console.error("Error for retrieve profile data",error);
        res.redirect("/pageNotFound")
    }
};

const getEditProfile = async (req,res)=>{
    try {
        
       const userId =  req.session.user || req.user;
       const userData = await User.findById(userId);
       if(!userData){
        return res.redirect('/login');
       }
        res.render('editProfile',{user:userData});

    } catch (error) {
        console.error("Error for retrieve editProfile page",error);
        res.redirect("/pageNotFound");
    }
}

const updateProfile = async (req,res)=>{

    const { name,email,phone } = req.body;

    try {
        
        const userSession = req.session.user || req.user;
        
        if (!userSession || !userSession._id) {
            return res.status(401).send("Unauthorized: No user session found");
        }
 
        const userId = userSession._id;

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { name, email, phone},
            { new: true }
      );
      if (!updatedUser) {
        throw new Error("Failed to update user profile");
    }

        req.session.user = updatedUser;
        res.redirect('/userProfile');

    } catch (error) {
        console.error("Error updating profile:", error.message);
        res.status(500).send("Server error occurred");
    }
}


const getAddAddress = async (req,res) =>{
    try {
        const userSession = req.session.user || req.user;
    
        if (!userSession || !userSession._id) {
            
            return res.redirect('/login');

        }
        res.render('addAddress');

    } catch (error) {
        console.error("Error accessing the add address page:", error.message);
        res.status(500).send("Server error occurred");
    }
}



const addNewAddress = async (req,res) =>{
    const { street, town, postcode, phone } = req.body;
    const userSession = req.session.user || req.user;

    if (!userSession || !userSession._id) {
        return res.status(401).send("Unauthorized: No user session found");
    }
    try {
        
        const user = await User.findById(userSession._id);

        if (!user) {
            return res.status(404).send("User not found");
        }
        const newAddress = {
            street,
            town,
            postcode,
            phone
        };
        
        user.address.push(newAddress); 

        await user.save();
        res.redirect('/userProfile');

    } catch (error) {
        
        console.error("Error adding address:", error.message);
        res.status(500).send("Server error occurred");

    }
}

const getEditAddress = async (req,res) =>{

    const userSession = req.session.user || req.user;

    if (!userSession || !userSession._id) {
        return res.redirect('/login'); // Redirect to login if not authenticated
    }

    const addressId = req.params.id;
    console.log('Requested address ID:', addressId); 

    try {

        const user = await User.findById(userSession._id);
        if (!user) {
            return res.status(404).send('User not found');
        }
        console.log('User Address:', user.address);

        const address = await Address.findOne({ _id: addressId, userId: userSession._id });

        if (!address) {
            return res.status(404).send('Address not found or unauthorized access');
        }

        res.render('editAddress', { address });
        
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }


}



const editAddress = async (req,res) =>{
    const { street, town, postcode, phone } = req.body;
    const { addressId } = req.params;
    const userSession = req.session.user || req.user;

    try {

        console.log('User Session:', userSession);
        console.log('Address ID:', addressId);

        const user = await User.findById(userSession._id);
        if (!user) {
            return res.status(404).send("User not found");
        }

        console.log('User Addresses:', user.address)

        const address = user.address.id(addressId);
        if (!address) {
            return res.status(404).send("Address not found");
        }

        console.log('Address to Edit:', address);

        address.street = street;
        address.town = town;
        address.postcode = postcode;
        address.phone = phone;

        await user.save();
        res.redirect("/userProfile");

    } catch (error) {
        
        console.error(error);
        res.status(500).send("Error updating address");

    }
}

const deleteAddress  = async (req,res)=>{
    const { addressId } = req.params;
    const userSession = req.session.user || req.user;
    try {
        const user = await User.findById(userSession._id);

        if (!user) {
            return res.status(404).send("User not found");
        }

        user.address = user.address.filter((addr) => addr._id.toString() !== addressId);
        await user.save();

        res.redirect("/userProfile");

    } catch (error) {
         console.error(error);
         res.status(500).send("Error deleting address");
    }
}

module.exports = {
    userProfile,
    getEditProfile,
    updateProfile,
    getAddAddress,
    addNewAddress,
    editAddress,
    deleteAddress,
    getEditAddress,
};