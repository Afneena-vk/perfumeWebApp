const User = require("../models/userSchema");

const userAuth = (req,res,next)=>{
    if(req.session.user || req.user){
        if(req.user){
            req.session.user = req.user;
        }
        User.findById(req.session.user)
        .then(data=>{
            if(data && !data.isBlocked){
                next();
            }else{
                req.session.user = null;
                res.redirect("/login")
            }
        })
        .catch(error=>{
            console.log("Error in user auth middleware");
            res.status(500).send("Internal Server error")
        })
    }else {
        res.redirect("/login")
    }
}

const adminAuth = (req,res,next)=>{
    User.findOne({isAdmin:true})
    .then(data=>{
        if(data && req.session.admin){
            next();
        }else {
            res.redirect("/admin/login")
        }
    })
    .catch(error=>{
        console.log("Error in adminAuth middleware",error);
        res.status(500).send("internal Server Error")
    })
}


module.exports={
    adminAuth,
    userAuth,
}