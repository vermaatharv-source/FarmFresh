const mongoose = require('mongoose');
const batchSchema = new mongoose.Schema({
  batchId:{type:String,required:true,unique:true},
  fpo:{type:mongoose.Schema.Types.ObjectId,ref:'Fpo',required:true,index:true},
  farmer:{type:mongoose.Schema.Types.ObjectId,ref:'Farmer',required:true,index:true},
  produceType:{type:String,required:true,trim:true},
  rawQuantityKg:{type:Number,required:true,min:0},
  harvestDate:{type:Date},collectionDate:{type:Date,default:Date.now},
  grading:{
    gradeA_Kg:{type:Number,default:0,min:0},gradeB_Kg:{type:Number,default:0,min:0},gradeC_Kg:{type:Number,default:0,min:0},
    qualityScore:{type:Number,min:0,max:100},qualityImages:[String],status:{type:String,enum:['Pending','Approved','Rejected'],default:'Pending'},
    gradedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'},gradedAt:{type:Date}
  },
  gradingHistory:[{gradeA_Kg:Number,gradeB_Kg:Number,gradeC_Kg:Number,qualityScore:Number,qualityImages:[String],status:{type:String,enum:['Pending','Approved','Rejected']},gradedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'},gradedAt:{type:Date,default:Date.now}}],
  pricingSnapshot:{gradeAPricePerKg:Number,gradeBPricePerKg:Number,gradeCPricePerKg:Number,referenceMarketPrice:Number,effectiveFrom:Date},
  amountOwedToFarmer:{type:Number,default:0,min:0},
  payoutStatus:{type:String,enum:['PENDING','PAID','PARTIAL'],default:'PENDING'},
  paidAt:{type:Date},
  listedAsProductIds:[{type:mongoose.Schema.Types.ObjectId,ref:'Listing'}],
  qrCodeUrl:{type:String}
},{timestamps:true});
module.exports=mongoose.model('Batch',batchSchema);
