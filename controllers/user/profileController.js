
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
       //const address = await Address.find({userId:userSession._id});
       const addressDoc = await Address.findOne({ userId: userSession._id });

       const addresses = addressDoc ? addressDoc.address : []; // Extract nested addresses


       if (!user) {
        return res.status(404).send("User not found");
    }

    

       res.render('profile',{
        user:user,
        orders: orders,
        address: addresses,
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


const addNewAddress = async (req, res) => {
    const { addressType, name, city, landMark, state, pincode, phone } = req.body;
    const userSession = req.session.user || req.user;

    if (!userSession || !userSession._id) {
        return res.status(401).send("Unauthorized: No user session found");
    }

    try {
      
        const newAddress = {
            addressType,
            name,
            city,
            landMark,
            state,
            pincode,
            phone
        };

        
        const updatedUser = await Address.findOneAndUpdate(
            { userId: userSession._id }, 
            {
                $push: {
                    address: newAddress, 
                },
            },
            { new: true, upsert: true } 
        );

        res.redirect('/userProfile'); 
    } catch (error) {
        console.error("Error adding address:", error.message);
        res.status(500).send("Server error occurred");
    }
};


const getEditAddress = async (req,res) =>{
    try {
        const userSession = req.session.user || req.user; // Retrieve user from session or req.user
        if (!userSession) {
            return res.redirect('/login'); // Redirect to login if no user session
        }

        const userId = userSession._id;
        //const addressId = req.params.id;
        const addressId = req.query.id;

        const userAddresses = await Address.findOne({ userId });
        if (!userAddresses) {
            return res.status(404).send('No address found for this user.');
        }

        const address = userAddresses.address.id(addressId);
        if (!address) {
            return res.status(404).send('Address not found.');
        }

        res.render('editAddress', { address });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
    

}



// const editAddress = async (req,res) =>{
//     const { street, town, postcode, phone } = req.body;
//     const { addressId } = req.params;
//     const userSession = req.session.user || req.user;

//     try {

//         console.log('User Session:', userSession);
//         console.log('Address ID:', addressId);

//         const user = await User.findById(userSession._id);
//         if (!user) {
//             return res.status(404).send("User not found");
//         }

//         console.log('User Addresses:', user.address)

//         const address = user.address.id(addressId);
//         if (!address) {
//             return res.status(404).send("Address not found");
//         }

//         console.log('Address to Edit:', address);

//         address.street = street;
//         address.town = town;
//         address.postcode = postcode;
//         address.phone = phone;

//         await user.save();
//         res.redirect("/userProfile");

//     } catch (error) {
        
//         console.error(error);
//         res.status(500).send("Error updating address");

//     }
// }

const editAddress = async (req,res)=>{
    try {
        const userSession = req.session.user || req.user; // Retrieve user from session or req.user
        if (!userSession) {
            return res.redirect('/login'); // Redirect to login if no user session
        }

        const userId = userSession._id;
        // const addressId = req.params.id;
        const addressId = req.query.id;
        const updatedData = {
            addressType: req.body.addressType,
            name: req.body.name,
            city: req.body.city,
            landMark: req.body.landMark,
            state: req.body.state,
            pincode: req.body.pincode,
            phone: req.body.phone,
        };

        const userAddresses = await Address.findOne({ userId });
        if (!userAddresses) {
            return res.status(404).send('No address found for this user.');
        }

        const address = userAddresses.address.id(addressId);
        if (!address) {
            return res.status(404).send('Address not found.');
        }

        // Update the address fields
        Object.assign(address, updatedData);

        await userAddresses.save();

        res.redirect('/userProfile'); // Redirect to profile or address list
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
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

        const result = await Address.findOneAndUpdate(
            { userId: userSession._id },
            { $pull: { address: { _id: addressId } } },
            { new: true }
        );

        if (!result) {
            return res.status(404).send('Address not found');
        }

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