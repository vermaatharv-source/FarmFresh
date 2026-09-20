const mongoose = require('mongoose');
const gradePriceConfigSchema = new mongoose.Schema({
  fpo:{type:mongoose.Schema.Types.ObjectId,ref:'Fpo',required:true,index:true},
  cropName:{type:String,required:true,trim:true},
  gradeAPricePerKg:{type:Number,required:true,min:0},
  gradeBPricePerKg:{type:Number,required:true,min:0},
  gradeCPricePerKg:{type:Number,required:true,min:0},
  referenceMarketPrice:{type:Number,default:0,min:0},
  effectiveFrom:{type:Date,default:Date.now,index:true},
  isActive:{type:Boolean,default:true,index:true},
  pricingSource:{type:String,enum:['MANUAL','AUTO_MANDI'],default:'MANUAL'},
  createdBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'},
  updatedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'}
},{timestamps:true});
gradePriceConfigSchema.index({fpo:1,cropName:1,isActive:1,effectiveFrom:-1});
gradePriceConfigSchema.methods.getPriceForGrade=function(grade){return ({A:this.gradeAPricePerKg,B:this.gradeBPricePerKg,C:this.gradeCPricePerKg})[String(grade).toUpperCase()] ?? null;};
module.exports=mongoose.model('GradePriceConfig',gradePriceConfigSchema);