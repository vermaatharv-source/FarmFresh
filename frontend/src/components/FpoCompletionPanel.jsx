import { useEffect, useState } from 'react';
import API from '../api/axios';

const blankProfile = {
  name: '', registrationType: '', registrationNumber: '', dateOfIncorporation: '', pan: '', gstin: '',
  fssaiLicense: '', udyamNumber: '', cbboName: '', schemeName: '', shareholderFarmerCount: '',
  managerName: '', managerContact: '', phone: '', email: '', address: '', district: '', state: '',
  pincode: '', creditLineAvailable: 0,
};

const kycStyles = {
  Verified: 'bg-green-50 border-green-200 text-green-800',
  Pending: 'bg-amber-50 border-amber-200 text-amber-800',
  Rejected: 'bg-red-50 border-red-200 text-red-800',
};

export default function FpoCompletionPanel({ profile, farmers, batches, onRefresh }) {
  const [prices,setPrices]=useState([]); const [weekly,setWeekly]=useState([]); const [staff,setStaff]=useState([]);
  const [price,setPrice]=useState({cropName:'',gradeAPricePerKg:'',gradeBPricePerKg:'',gradeCPricePerKg:'',referenceMarketPrice:''});
  const [profileForm,setProfileForm]=useState(blankProfile);
  const [excel,setExcel]=useState(null); const [staffForm,setStaffForm]=useState({name:'',email:'',password:'',location:''});
  const [payoutBatch,setPayoutBatch]=useState(''); const [preview,setPreview]=useState(null); const [message,setMessage]=useState('');

  useEffect(()=>{if(!profile)return;setProfileForm({name:profile.name||'',registrationType:profile.registrationType||'',registrationNumber:profile.registrationNumber||'',dateOfIncorporation:profile.dateOfIncorporation?String(profile.dateOfIncorporation).slice(0,10):'',pan:profile.pan||'',gstin:profile.gstin||'',fssaiLicense:profile.fssaiLicense||'',udyamNumber:profile.udyamNumber||'',cbboName:profile.cbboName||'',schemeName:profile.schemeName||'',shareholderFarmerCount:profile.shareholderFarmerCount??'',managerName:profile.managerName||'',managerContact:profile.managerContact||'',phone:profile.contactDetails?.phone||'',email:profile.contactDetails?.email||'',address:profile.contactDetails?.address||'',district:profile.contactDetails?.district||'',state:profile.contactDetails?.state||'',pincode:profile.contactDetails?.pincode||'',creditLineAvailable:profile.creditLineAvailable||0});load();},[profile]);
  const load=async()=>{try{const [p,w,s]=await Promise.all([API.get('/grade-prices'),API.get('/reports/weekly'),API.get('/fpo/profile').then(r=>r.data.staff||[])]);setPrices(p.data);setWeekly(w.data);setStaff(s);}catch(e){console.error(e)}};
  const saveProfile=async e=>{e.preventDefault();try{const pf=profileForm;const r=await API.patch('/fpo/profile',{name:pf.name,registrationType:pf.registrationType,registrationNumber:pf.registrationNumber,dateOfIncorporation:pf.dateOfIncorporation,pan:pf.pan,gstin:pf.gstin,fssaiLicense:pf.fssaiLicense,udyamNumber:pf.udyamNumber,cbboName:pf.cbboName,schemeName:pf.schemeName,shareholderFarmerCount:pf.shareholderFarmerCount===''?'':Number(pf.shareholderFarmerCount),managerName:pf.managerName,managerContact:pf.managerContact,creditLineAvailable:Number(pf.creditLineAvailable)||0,contactDetails:{phone:pf.phone,email:pf.email,address:pf.address,district:pf.district,state:pf.state,pincode:pf.pincode}});setMessage('FPO profile updated.');onRefresh?.(r.data); }catch(e){setMessage(e.response?.data?.message||'Profile update failed.')}};
  const setPf=(k,v)=>setProfileForm(p=>({...p,[k]:v}));
  const field=(label,k,extra={})=><label key={k} className="block text-xs font-medium text-gray-600">{label}<input value={profileForm[k]} onChange={e=>setPf(k,e.target.value)} className="mt-1 w-full p-2.5 border rounded-lg text-sm text-gray-900 font-normal" {...extra}/></label>;
  const savePrice=async e=>{e.preventDefault();try{await API.post('/grade-prices',{...price,gradeAPricePerKg:Number(price.gradeAPricePerKg),gradeBPricePerKg:Number(price.gradeBPricePerKg),gradeCPricePerKg:Number(price.gradeCPricePerKg),referenceMarketPrice:Number(price.referenceMarketPrice)||0});setPrice({cropName:'',gradeAPricePerKg:'',gradeBPricePerKg:'',gradeCPricePerKg:'',referenceMarketPrice:''});setMessage('Grade pricing saved.');load();}catch(e){setMessage(e.response?.data?.message||'Could not save pricing.')}};
  const importExcel=async e=>{e.preventDefault();if(!excel)return;try{const f=new FormData();f.append('file',excel);const r=await API.post('/fpo/farmers/import-excel',f,{headers:{'Content-Type':'multipart/form-data'}});setMessage(r.data.message);setExcel(null);onRefresh?.();}catch(e){setMessage(e.response?.data?.message||'Excel import failed.')}};
  const addStaff=async e=>{e.preventDefault();try{await API.post('/fpo/staff',staffForm);setStaffForm({name:'',email:'',password:'',location:''});setMessage('Staff member added.');load();}catch(e){setMessage(e.response?.data?.message||'Staff creation failed.')}};
  const removeStaff=async id=>{if(!confirm('Deactivate this staff member?'))return;try{await API.delete(`/fpo/staff/${id}`);setMessage('Staff member deactivated.');load();}catch(e){setMessage(e.response?.data?.message||'Could not remove staff.')}};
  const payoutPreview=async()=>{try{const r=await API.get(`/fpo/batches/${payoutBatch}/payout-preview`);setPreview(r.data);}catch(e){setPreview(null);setMessage(e.response?.data?.message||'Payout preview failed.')}};
  const pay=async()=>{try{await API.post(`/fpo/batches/${payoutBatch}/payout`,{paymentMethod:'BANK_TRANSFER',fundedFrom:'FPO_CASH',transactionId:prompt('Enter transaction ID (leave blank for Pending):')||undefined});setMessage('Payout recorded.');setPreview(null);onRefresh?.();}catch(e){setMessage(e.response?.data?.message||'Payout failed.')}};
  return <div className="space-y-6">
    {message&&<div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-sm">{message}</div>}
    <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100"><h2 className="text-2xl font-bold text-gray-800 mb-4">FPO Completion Center</h2><p className="text-sm text-gray-500">All remaining FPO operations: profile, disclosed grade pricing, automatic farmer payout, Excel import, staff control and weekly reporting.</p></section>
    <form onSubmit={saveProfile} className="bg-white p-6 rounded-xl shadow-sm border space-y-6">
      <div><h3 className="font-semibold text-gray-800">Organisation Profile</h3><p className="text-xs text-gray-500">Official details of the FPO, as per registration records.</p></div>
      {profile?.kycStatus&&<div className={`border rounded-lg px-4 py-3 text-sm ${kycStyles[profile.kycStatus]||'bg-gray-50 border-gray-200 text-gray-700'}`}><span className="font-semibold">KYC status: {profile.kycStatus}</span>{profile.kycStatus==='Rejected'&&profile.kycRejectionReason&&<span> — {profile.kycRejectionReason}</span>}{profile.kycStatus==='Pending'&&<span> — Upload registration documents and await review by the authority.</span>}</div>}
      <fieldset className="space-y-3"><legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Legal and registration</legend>
        <div className="grid md:grid-cols-2 gap-3">
          {field('FPO legal name','name',{required:true})}
          <label className="block text-xs font-medium text-gray-600">Registration type<select value={profileForm.registrationType} onChange={e=>setPf('registrationType',e.target.value)} className="mt-1 w-full p-2.5 border rounded-lg text-sm text-gray-900 font-normal bg-white"><option value="">Select</option><option value="Producer Company">Producer Company</option><option value="Cooperative Society">Cooperative Society</option><option value="Other">Other</option></select></label>
          {field('Registration number (CIN / society reg. no.)','registrationNumber',{required:true})}
          {field('Date of incorporation','dateOfIncorporation',{type:'date'})}
        </div>
      </fieldset>
      <fieldset className="space-y-3"><legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Tax and compliance</legend>
        <div className="grid md:grid-cols-2 gap-3">
          {field('PAN','pan',{maxLength:10,placeholder:'ABCDE1234F'})}
          {field('GSTIN','gstin',{maxLength:15})}
          {field('FSSAI licence number','fssaiLicense')}
          {field('Udyam registration number','udyamNumber')}
        </div>
      </fieldset>
      <fieldset className="space-y-3"><legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Promotion and membership</legend>
        <div className="grid md:grid-cols-2 gap-3">
          {field('Promoting agency / CBBO','cbboName')}
          {field('Scheme name','schemeName')}
          {field('Number of shareholder farmers','shareholderFarmerCount',{type:'number',min:0,step:1})}
          {field('Credit line available (INR)','creditLineAvailable',{type:'number',min:0})}
        </div>
      </fieldset>
      <fieldset className="space-y-3"><legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Management and contact</legend>
        <div className="grid md:grid-cols-2 gap-3">
          {field('Manager / CEO name','managerName')}
          {field('Manager contact number','managerContact')}
          {field('Organisation phone','phone')}
          {field('Organisation email','email',{type:'email'})}
          <div className="md:col-span-2">{field('Registered address','address')}</div>
          {field('District','district')}
          {field('State','state')}
          {field('Pincode','pincode',{maxLength:6})}
        </div>
      </fieldset>
      <button className="w-full bg-emerald-700 text-white py-2.5 rounded-lg font-medium">Save Profile</button>
    </form>
    <div className="grid lg:grid-cols-2 gap-6"><form onSubmit={savePrice} className="bg-white p-6 rounded-xl shadow-sm border space-y-3"><h3 className="font-semibold">Grade Price Configuration</h3><input placeholder="Crop name" value={price.cropName} onChange={e=>setPrice({...price,cropName:e.target.value})} className="w-full p-2.5 border rounded-lg" required/><div className="grid grid-cols-3 gap-2">{['A','B','C'].map(g=><input key={g} type="number" min="0" step="0.01" placeholder={`Grade ${g} ₹/kg`} value={price[`grade${g}PricePerKg`]} onChange={e=>setPrice({...price,[`grade${g}PricePerKg`]:e.target.value})} className="p-2.5 border rounded-lg" required/>)}</div><input type="number" min="0" step="0.01" placeholder="Reference market price ₹/kg" value={price.referenceMarketPrice} onChange={e=>setPrice({...price,referenceMarketPrice:e.target.value})} className="w-full p-2.5 border rounded-lg"/><button className="w-full bg-emerald-600 text-white py-2.5 rounded-lg">Save New Pricing</button><div className="text-xs text-gray-500">Existing configurations are retained as history; the newest active configuration is used for grading.</div></form>
      <div className="bg-white p-6 rounded-xl shadow-sm border"><h3 className="font-semibold mb-3">Active / Historical Prices</h3>{prices.map(p=><div key={p._id} className="border-b py-2 text-sm flex justify-between"><span>{p.cropName} — A ₹{p.gradeAPricePerKg} / B ₹{p.gradeBPricePerKg} / C ₹{p.gradeCPricePerKg}</span><span>{p.isActive?'Active':'Historical'}</span></div>)}{!prices.length&&<p className="text-sm text-gray-400">No price configurations yet.</p>}</div></div>
    <div className="grid lg:grid-cols-2 gap-6"><form onSubmit={importExcel} className="bg-white p-6 rounded-xl shadow-sm border space-y-3"><h3 className="font-semibold">Excel Farmer Import</h3><p className="text-xs text-gray-500">Columns: name, phone, aadhaarNumber, address, accountNumber, ifscCode, bankName.</p><input type="file" accept=".xlsx,.xls" onChange={e=>setExcel(e.target.files?.[0]||null)} required/><button className="bg-emerald-600 text-white px-4 py-2 rounded-lg">Import Excel</button></form>
      <div className="bg-white p-6 rounded-xl shadow-sm border"><h3 className="font-semibold mb-3">Automatic Grade-Based Payout</h3><select value={payoutBatch} onChange={e=>{setPayoutBatch(e.target.value);setPreview(null)}} className="w-full p-2.5 border rounded-lg"><option value="">Select approved batch</option>{batches.filter(b=>b.grading?.status==='Approved'&&b.payoutStatus!=='PAID').map(b=><option key={b._id} value={b._id}>{b.batchId} — {b.produceType} — ₹{b.amountOwedToFarmer||0}</option>)}</select><button type="button" onClick={payoutPreview} disabled={!payoutBatch} className="mt-2 bg-gray-800 text-white px-4 py-2 rounded-lg disabled:opacity-40">Calculate Preview</button>{preview&&<div className="mt-3 bg-gray-50 p-3 rounded-lg text-sm">A: {preview.breakdown.A.kg}kg × ₹{preview.breakdown.A.pricePerKg}<br/>B: {preview.breakdown.B.kg}kg × ₹{preview.breakdown.B.pricePerKg}<br/>C: {preview.breakdown.C.kg}kg × ₹{preview.breakdown.C.pricePerKg}<div className="font-bold mt-2">Total owed: ₹{preview.totalAmount}</div><button onClick={pay} className="mt-2 bg-emerald-600 text-white px-4 py-2 rounded-lg">Record Payout</button></div>}</div></div>
    <div className="grid lg:grid-cols-2 gap-6"><div className="bg-white p-6 rounded-xl shadow-sm border"><h3 className="font-semibold mb-3">Staff Management</h3><form onSubmit={addStaff} className="grid grid-cols-2 gap-2 mb-4">{['name','email','password','location'].map(k=><input key={k} type={k==='email'?'email':k==='password'?'password':'text'} placeholder={k} value={staffForm[k]} onChange={e=>setStaffForm({...staffForm,[k]:e.target.value})} className="p-2 border rounded-lg" required/>)}<button className="col-span-2 bg-emerald-600 text-white py-2 rounded-lg">Add Staff</button></form>{staff.map(s=><div key={s._id} className="flex justify-between items-center border-b py-2 text-sm"><span>{s.name} — {s.email}</span><button onClick={()=>removeStaff(s._id)} className="text-red-600">Deactivate</button></div>)}</div>
      <div className="bg-white p-6 rounded-xl shadow-sm border"><h3 className="font-semibold mb-3">Weekly Report</h3>{weekly.map(w=><div key={w.week} className="flex justify-between border-b py-2 text-sm"><span>Week of {w.week}</span><span>{w.intakeKg}kg · ₹{w.revenue}</span></div>)}{!weekly.length&&<p className="text-sm text-gray-400">No weekly data yet.</p>}</div></div>
  </div>;
}