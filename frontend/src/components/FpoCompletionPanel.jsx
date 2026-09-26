import { useEffect, useState } from 'react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import MandiPriceBoard from './Mandipriceboard';

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

export default function FpoCompletionPanel({ profile, farmers = [], batches = [], onRefresh }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isAdmin = user?.role === 'fpo_admin';
  const [prices,setPrices]=useState([]); const [weekly,setWeekly]=useState([]); const [staff,setStaff]=useState([]);
  const [price,setPrice]=useState({cropName:'',gradeAPricePerKg:'',gradeBPricePerKg:'',gradeCPricePerKg:'',referenceMarketPrice:''});
  const [mandiPrices,setMandiPrices]=useState([]); const [mandiLoading,setMandiLoading]=useState(false); const [mandiSyncing,setMandiSyncing]=useState(false);
  const [mandiHint,setMandiHint]=useState(null); const [refMarketTouched,setRefMarketTouched]=useState(false); const [gradesTouched,setGradesTouched]=useState(false);
  const [gradeDiscounts,setGradeDiscounts]=useState({A:0,B:15,C:30}); // % below mandi modal price/kg, per grade — tune per crop
  const [autoRules,setAutoRules]=useState([]); const [autoEnabled,setAutoEnabled]=useState(false);
  const [profileForm,setProfileForm]=useState(blankProfile);
  const [excel,setExcel]=useState(null); const [staffForm,setStaffForm]=useState({name:'',email:'',password:'',location:''});
  const [payoutBatch,setPayoutBatch]=useState(''); const [preview,setPreview]=useState(null); const [message,setMessage]=useState('');

  useEffect(()=>{if(!profile)return;setProfileForm({name:profile.name||'',registrationType:profile.registrationType||'',registrationNumber:profile.registrationNumber||'',dateOfIncorporation:profile.dateOfIncorporation?String(profile.dateOfIncorporation).slice(0,10):'',pan:profile.pan||'',gstin:profile.gstin||'',fssaiLicense:profile.fssaiLicense||'',udyamNumber:profile.udyamNumber||'',cbboName:profile.cbboName||'',schemeName:profile.schemeName||'',shareholderFarmerCount:profile.shareholderFarmerCount??'',managerName:profile.managerName||'',managerContact:profile.managerContact||'',phone:profile.contactDetails?.phone||'',email:profile.contactDetails?.email||'',address:profile.contactDetails?.address||'',district:profile.contactDetails?.district||'',state:profile.contactDetails?.state||'',pincode:profile.contactDetails?.pincode||'',creditLineAvailable:profile.creditLineAvailable||0});load();loadMandi();loadAutoRules();},[profile]);
  const load=async()=>{try{const [p,w,s]=await Promise.all([API.get('/grade-prices'),API.get('/reports/weekly'),API.get('/fpo/profile').then(r=>r.data.staff||[])]);setPrices(p.data);setWeekly(w.data);setStaff(s);}catch(e){console.error(e)}};
  const loadMandi=async()=>{setMandiLoading(true);try{const r=await API.get('/grade-prices/mandi-prices');setMandiPrices(r.data);}catch(e){console.error(e)}finally{setMandiLoading(false)}};
  const loadAutoRules=async()=>{try{const r=await API.get('/grade-prices/auto-rules');setAutoRules(r.data);}catch(e){console.error(e)}};
  const autoRuleFor=cropName=>{if(!cropName)return null;const q=cropName.trim().toLowerCase();return autoRules.find(r=>r.cropName?.toLowerCase()===q)||null;};
  const toggleAutoRule=async(id,isEnabled)=>{try{await API.patch(`/grade-prices/auto-rules/${id}/toggle`,{isEnabled});setMessage(isEnabled?'Auto-pricing resumed.':'Auto-pricing paused — price stays as last set until you resume or edit manually.');loadAutoRules();load();}catch(e){setMessage(e.response?.data?.message||'Could not update auto-pricing.')}};
  const removeAutoRule=async id=>{if(!confirm('Stop auto-pricing this crop? It goes back to manual.'))return;try{await API.delete(`/grade-prices/auto-rules/${id}`);setMessage('Auto-pricing removed for this crop.');loadAutoRules();}catch(e){setMessage(e.response?.data?.message||'Could not remove auto-pricing.')}};
  const syncMandiNow=async()=>{setMandiSyncing(true);try{await API.post('/grade-prices/sync');await Promise.all([loadMandi(),load(),loadAutoRules()]);setMessage('Mandi prices synced — auto-priced crops updated.');}catch(e){setMessage(e.response?.data?.message||'Mandi sync failed.')}finally{setMandiSyncing(false)}};
  const findMandi=cropName=>{if(!cropName)return null;const q=cropName.trim().toLowerCase();return mandiPrices.find(m=>m.commodityName?.toLowerCase()===q)||mandiPrices.find(m=>m.commodityName?.toLowerCase().includes(q))||null;};
  // Agmarknet/eNAM quotes prices per quintal (100kg); our grade prices are per kg — always convert before comparing or auto-filling.
  const perKg=v=>v==null?null:Math.round((Number(v)/100)*100)/100;
  const fetchMandiForCrop=async()=>{const cropName=price.cropName?.trim();if(!cropName)return;try{const r=await API.get('/grade-prices/mandi-reference',{params:{cropName}});setMandiHint(r.data);const base=perKg(r.data?.modalPrice);if(base==null)return;if(!refMarketTouched)setPrice(p=>({...p,referenceMarketPrice:base}));if(!gradesTouched)applyGradeDiscounts(base);}catch(e){setMandiHint(null)}};
  const round2=v=>Math.round(v*100)/100;
  const applyGradeDiscounts=base=>{const b=base??perKg(mandiHint?.modalPrice);if(b==null)return;setPrice(p=>({...p,gradeAPricePerKg:round2(b*(1-gradeDiscounts.A/100)),gradeBPricePerKg:round2(b*(1-gradeDiscounts.B/100)),gradeCPricePerKg:round2(b*(1-gradeDiscounts.C/100))}));};
  const setDiscount=(g,v)=>setGradeDiscounts(d=>({...d,[g]:Number(v)}));
  const saveProfile=async e=>{e.preventDefault();try{const pf=profileForm;const r=await API.patch('/fpo/profile',{name:pf.name,registrationType:pf.registrationType,registrationNumber:pf.registrationNumber,dateOfIncorporation:pf.dateOfIncorporation,pan:pf.pan,gstin:pf.gstin,fssaiLicense:pf.fssaiLicense,udyamNumber:pf.udyamNumber,cbboName:pf.cbboName,schemeName:pf.schemeName,shareholderFarmerCount:pf.shareholderFarmerCount===''?'':Number(pf.shareholderFarmerCount),managerName:pf.managerName,managerContact:pf.managerContact,creditLineAvailable:Number(pf.creditLineAvailable)||0,contactDetails:{phone:pf.phone,email:pf.email,address:pf.address,district:pf.district,state:pf.state,pincode:pf.pincode}});setMessage('FPO profile updated.');onRefresh?.(r.data); }catch(e){setMessage(e.response?.data?.message||'Profile update failed.')}};
  const setPf=(k,v)=>setProfileForm(p=>({...p,[k]:v}));
  const field=(label,k,extra={})=><label key={k} className="block text-xs font-medium text-gray-600">{label}<input value={profileForm[k]} onChange={e=>setPf(k,e.target.value)} className="mt-1 w-full p-2.5 border rounded-lg text-sm text-gray-900 font-normal" {...extra}/></label>;
  const savePrice=async e=>{e.preventDefault();try{if(autoEnabled){const r=await API.post('/grade-prices/auto-rules',{cropName:price.cropName,gradeADiscountPct:gradeDiscounts.A,gradeBDiscountPct:gradeDiscounts.B,gradeCDiscountPct:gradeDiscounts.C,isEnabled:true,sourceLanguage:language});setMessage(r.data.message||'Auto-pricing enabled.');}else{await API.post('/grade-prices',{...price,gradeAPricePerKg:Number(price.gradeAPricePerKg),gradeBPricePerKg:Number(price.gradeBPricePerKg),gradeCPricePerKg:Number(price.gradeCPricePerKg),referenceMarketPrice:Number(price.referenceMarketPrice)||0,sourceLanguage:language});setMessage('Grade pricing saved.');}setPrice({cropName:'',gradeAPricePerKg:'',gradeBPricePerKg:'',gradeCPricePerKg:'',referenceMarketPrice:''});setMandiHint(null);setRefMarketTouched(false);setGradesTouched(false);setAutoEnabled(false);load();loadAutoRules();}catch(e){setMessage(e.response?.data?.message||'Could not save pricing.')}};
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
    <div className="grid lg:grid-cols-2 gap-6"><form onSubmit={savePrice} className="bg-white p-6 rounded-xl shadow-sm border space-y-3"><h3 className="font-semibold">Grade Price Configuration</h3>
        <div><input placeholder="Crop name" value={price.cropName} onChange={e=>setPrice({...price,cropName:e.target.value})} onBlur={fetchMandiForCrop} className="w-full p-2.5 border rounded-lg" required/>
          {mandiHint&&<p className="text-xs text-gray-500 mt-1">Live Mandi: Min ₹{perKg(mandiHint.minPrice)} / Modal ₹{perKg(mandiHint.modalPrice)} / Max ₹{perKg(mandiHint.maxPrice)} per kg — {mandiHint.market}, {mandiHint.state} · {mandiHint.date?new Date(mandiHint.date).toLocaleDateString():''}</p>}
        </div>
        <div className="bg-gray-50 border rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between"><span className="text-xs font-medium text-gray-600">Auto-price from Mandi (% below live rate)</span>{mandiHint&&<button type="button" onClick={()=>{setGradesTouched(false);applyGradeDiscounts()}} className="text-xs text-emerald-700 hover:underline">⚡ Recalculate</button>}</div>
          <div className="grid grid-cols-3 gap-2">{['A','B','C'].map(g=><label key={g} className="text-xs text-gray-500 flex items-center gap-1">Grade {g}<input type="number" min="0" max="100" step="1" value={gradeDiscounts[g]} onChange={e=>setDiscount(g,e.target.value)} className="w-14 p-1 border rounded text-sm"/>%</label>)}</div>
          {!mandiHint&&<p className="text-[11px] text-gray-400">Enter a crop name above to pull the live rate and auto-fill grades below.</p>}
          <label className="flex items-start gap-2 text-xs text-gray-600 pt-1 border-t"><input type="checkbox" checked={autoEnabled} onChange={e=>setAutoEnabled(e.target.checked)} className="mt-0.5"/><span>Keep this crop updated automatically — re-applies these % on every daily mandi sync, no need to save again.</span></label>
        </div>
        <div className="grid grid-cols-3 gap-2">{['A','B','C'].map(g=><input key={g} type="number" min="0" step="0.01" placeholder={`Grade ${g} ₹/kg`} value={price[`grade${g}PricePerKg`]} onChange={e=>{setGradesTouched(true);setPrice({...price,[`grade${g}PricePerKg`]:e.target.value})}} className="p-2.5 border rounded-lg" disabled={autoEnabled} required/>)}</div>
        <div className="flex gap-2"><input type="number" min="0" step="0.01" placeholder="Reference market price ₹/kg" value={price.referenceMarketPrice} onChange={e=>{setRefMarketTouched(true);setPrice({...price,referenceMarketPrice:e.target.value})}} className="w-full p-2.5 border rounded-lg" disabled={autoEnabled}/><button type="button" onClick={()=>{setRefMarketTouched(false);fetchMandiForCrop()}} title="Refresh from Mandi" className="shrink-0 px-3 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">↻</button></div>
        <button className="w-full bg-emerald-600 text-white py-2.5 rounded-lg">{autoEnabled?'🔁 Enable Auto-Pricing':'Save New Pricing'}</button><div className="text-xs text-gray-500">Existing configurations are retained as history; the newest active configuration is used for grading.</div></form>
      <div className="bg-white p-6 rounded-xl shadow-sm border"><h3 className="font-semibold mb-3">Active / Historical Prices</h3>{prices.map(p=>{const mandi=findMandi(p.cropName);const mandiPerKg=mandi?perKg(mandi.modalPrice):null;const diff=mandiPerKg!=null?Number(p.gradeAPricePerKg)-mandiPerKg:null;const rule=autoRuleFor(p.cropName);return <div key={p._id} className="border-b py-2 text-sm flex justify-between items-center gap-2"><span>{p.cropName} — A ₹{p.gradeAPricePerKg} / B ₹{p.gradeBPricePerKg} / C ₹{p.gradeCPricePerKg}</span><span className="flex items-center gap-2 shrink-0">{mandiPerKg!=null&&<span className={`text-[10px] px-2 py-0.5 rounded-full ${diff>=0?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700'}`}>{diff>=0?'≥':'<'} mandi ₹{mandiPerKg}/kg</span>}{p.isActive&&rule&&<span className={`text-[10px] px-2 py-0.5 rounded-full ${rule.isEnabled?'bg-blue-50 text-blue-700':'bg-gray-100 text-gray-500'}`}>{rule.isEnabled?'🔁 Auto':'⏸ Auto paused'}</span>}<span>{p.isActive?'Active':'Historical'}</span>{p.isActive&&rule&&<button type="button" onClick={()=>toggleAutoRule(rule._id,!rule.isEnabled)} className="text-[10px] text-gray-400 hover:text-gray-700 underline">{rule.isEnabled?'pause':'resume'}</button>}</span></div>})}{!prices.length&&<p className="text-sm text-gray-400">No price configurations yet.</p>}</div></div>
    <MandiPriceBoard prices={mandiPrices} loading={mandiLoading} syncing={mandiSyncing} onSync={syncMandiNow} isAdmin={isAdmin}/>
    <div className="grid lg:grid-cols-2 gap-6"><form onSubmit={importExcel} className="bg-white p-6 rounded-xl shadow-sm border space-y-3"><h3 className="font-semibold">Excel Farmer Import</h3><p className="text-xs text-gray-500">Columns: name, phone, aadhaarNumber, address, accountNumber, ifscCode, bankName.</p><input type="file" accept=".xlsx,.xls" onChange={e=>setExcel(e.target.files?.[0]||null)} required/><button className="bg-emerald-600 text-white px-4 py-2 rounded-lg">Import Excel</button></form>
      <div className="bg-white p-6 rounded-xl shadow-sm border"><h3 className="font-semibold mb-3">Automatic Grade-Based Payout</h3><select value={payoutBatch} onChange={e=>{setPayoutBatch(e.target.value);setPreview(null)}} className="w-full p-2.5 border rounded-lg"><option value="">Select approved batch</option>{(batches||[]).filter(b=>b.grading?.status==='Approved'&&b.payoutStatus!=='PAID').map(b=><option key={b._id} value={b._id}>{b.batchId} — {b.produceType} — ₹{b.amountOwedToFarmer||0}</option>)}</select><button type="button" onClick={payoutPreview} disabled={!payoutBatch} className="mt-2 bg-gray-800 text-white px-4 py-2 rounded-lg disabled:opacity-40">Calculate Preview</button>{preview&&<div className="mt-3 bg-gray-50 p-3 rounded-lg text-sm">A: {preview.breakdown?.gradeA?.qtyKg ?? preview.breakdown?.A?.kg ?? 0}kg × ₹{preview.breakdown?.gradeA?.pricePerKg ?? preview.breakdown?.A?.pricePerKg ?? 0}<br/>B: {preview.breakdown?.gradeB?.qtyKg ?? preview.breakdown?.B?.kg ?? 0}kg × ₹{preview.breakdown?.gradeB?.pricePerKg ?? preview.breakdown?.B?.pricePerKg ?? 0}<br/>C: {preview.breakdown?.gradeC?.qtyKg ?? preview.breakdown?.C?.kg ?? 0}kg × ₹{preview.breakdown?.gradeC?.pricePerKg ?? preview.breakdown?.C?.pricePerKg ?? 0}<div className="font-bold mt-2">Total owed: ₹{preview.amountOwedToFarmer ?? preview.totalAmount ?? 0}</div><button onClick={pay} className="mt-2 bg-emerald-600 text-white px-4 py-2 rounded-lg">Record Payout</button></div>}</div></div>
    <div className="grid lg:grid-cols-2 gap-6"><div className="bg-white p-6 rounded-xl shadow-sm border"><h3 className="font-semibold mb-3">Staff Management</h3><form onSubmit={addStaff} className="grid grid-cols-2 gap-2 mb-4">{['name','email','password','location'].map(k=><input key={k} type={k==='email'?'email':k==='password'?'password':'text'} placeholder={k} value={staffForm[k]} onChange={e=>setStaffForm({...staffForm,[k]:e.target.value})} className="p-2 border rounded-lg" required/>)}<button className="col-span-2 bg-emerald-600 text-white py-2 rounded-lg">Add Staff</button></form>{staff.map(s=><div key={s._id} className="flex justify-between items-center border-b py-2 text-sm"><span>{s.name} — {s.email}</span><button onClick={()=>removeStaff(s._id)} className="text-red-600">Deactivate</button></div>)}</div>
      <div className="bg-white p-6 rounded-xl shadow-sm border"><h3 className="font-semibold mb-3">Weekly Report</h3>{weekly.map(w=><div key={w.week} className="flex justify-between border-b py-2 text-sm"><span>Week of {w.week}</span><span>{w.intakeKg}kg · ₹{w.revenue}</span></div>)}{!weekly.length&&<p className="text-sm text-gray-400">No weekly data yet.</p>}</div></div>
  </div>;
}