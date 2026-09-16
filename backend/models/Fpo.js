const mongoose = require('mongoose');
const fpoSchema = new mongoose.Schema({
  name:{type:String,required:true,trim:true},
  registrationNumber:{type:String,required:true,unique:true,trim:true},
  cbboName:{type:String,default:''},
  managerName:{type:String,default:''},
  managerContact:{type:String,default:''},
  kycStatus:{type:String,enum:['Pending','Verified','Rejected'],default:'Pending'},
  kycRejectionReason:{type:String,default:''},
  kycDocuments:[{type:String}],
  contactDetails:{
    phone:{type:String,default:''},email:{type:String,required:true},address:{type:String,default:''},
    district:{type:String,default:''},state:{type:String,default:''},pincode:{type:String,default:''}
  },
  creditLineAvailable:{type:Number,default:0,min:0},
  adminUser:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,unique:true},
  staff:[{type:mongoose.Schema.Types.ObjectId,ref:'User'}]
},{timestamps:true});
module.exports=mongoose.model('Fpo',fpoSchema);
