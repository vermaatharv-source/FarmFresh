import React, { useCallback, useEffect, useState, useMemo } from 'react';
import API from '../../api/axios';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const kg = (n) => `${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg`;
const date = (v) => (v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const input = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all';
const btn = 'rounded-lg px-4 py-2 text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-sm transition-all disabled:opacity-50';

function Card({ title, subtitle, badge, action, children, className = '' }) {
  return (
    <section className={`bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm ${className}`}>
      {(title || subtitle || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900 text-base">{title}</h3>
              {badge && <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">{badge}</span>}
            </div>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

function Stat({ label, value, sub, icon, trend, color = 'emerald' }) {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1.5 tracking-tight">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-1 font-medium">{sub}</p>}
        </div>
        {icon && (
          <div className={`p-2.5 rounded-xl bg-${color}-50 text-${color}-600 text-lg flex items-center justify-center`}>
            {icon}
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center text-xs text-slate-600">
          <span className="font-medium text-emerald-600 mr-1">{trend}</span> vs previous period
        </div>
      )}
    </div>
  );
}

function Empty({ text = 'No records yet.', icon = '📭' }) {
  return (
    <div className="py-10 text-center text-slate-400">
      <div className="text-3xl mb-2">{icon}</div>
      <p className="text-sm font-medium">{text}</p>
    </div>
  );
}

// Built-in Software Operations Catalog for instant frontend responses
const OPERATIONS_GUIDE = [
  {
    id: 'add-farmer',
    title: 'How to Register / Add a New Farmer',
    category: 'Farmers',
    tabId: 'farmers',
    icon: '🌾',
    summary: 'Add an individual farmer with personal, landholding, crop, and DBT bank account details.',
    steps: [
      'Click the "Farmers" tab on the main dashboard menu.',
      'Under "Register New Farmer", fill in the farmer\'s Full Name, Phone Number, Aadhaar Number, Gender, and Category.',
      'Fill in Farm Details: Village, Block, District, State, Landholding in Acres, and Crops Grown.',
      'Enter DBT Bank details: Account Number, IFSC Code, and Bank Name (required for direct payouts).',
      'Click "Register Farmer" to save.',
    ],
    tips: 'Ensure the 10-digit phone number and IFSC code are accurate for seamless digital settlements.',
  },
  {
    id: 'bulk-farmers',
    title: 'How to Bulk Upload Farmers via CSV',
    category: 'Farmers',
    tabId: 'farmers',
    icon: '📊',
    summary: 'Import dozens or hundreds of farmer member records simultaneously using a spreadsheet.',
    steps: [
      'Go to the "Farmers" tab in the main navigation.',
      'Scroll to the "Bulk Upload Farmers (CSV)" section.',
      'Ensure your CSV contains columns: name, phone, aadhaarNumber, village, district, state, landHoldingAcres, cropsGrown, accountNumber, ifscCode.',
      'Click "Choose File" and select your .csv file.',
      'Click "Upload CSV" to batch-import all farmers into your FPO.',
    ],
    tips: 'Verify there are no duplicate phone numbers or invalid characters before importing.',
  },
  {
    id: 'intake-batch',
    title: 'How to Record Produce Intake & Create Batches',
    category: 'Intake & Quality',
    tabId: 'intake',
    icon: '⚖️',
    summary: 'Record harvest delivery from a farmer at your collection center and issue a traceable Batch ID.',
    steps: [
      'Navigate to the "Intake & Grading" tab.',
      'Under "Record New Produce Intake", select the registered Farmer from the dropdown.',
      'Enter Produce Type (e.g. Tomatoes, Basmati Rice, Potatoes, Onions, Wheat).',
      'Enter the Raw Quantity in kg received on the weigh scale.',
      'Pick the Harvest Date.',
      'Click "Record Intake & Generate Batch". A unique Batch ID and digital QR passport are generated instantly.',
    ],
    tips: 'The generated batch ID enables end-to-end QR code traceability from farm to consumer plate.',
  },
  {
    id: 'grading-quality',
    title: 'How to Perform Batch Grading & Quality Inspection',
    category: 'Intake & Quality',
    tabId: 'intake',
    icon: '🔍',
    summary: 'Inspect harvested produce and divide it into Grade A, Grade B, and Grade C stock.',
    steps: [
      'Go to the "Intake & Grading" tab and check "Pending Batches for Grading".',
      'Click "Grade This Batch" on the target batch row.',
      'Enter quantities for Grade A (Premium), Grade B (Standard), and Grade C (Local/Processing) in kg.',
      'Enter the Quality Score (0 to 100).',
      'Select Status ("Approved" or "Rejected").',
      'Click "Submit Grading". Graded stock automatically enters your active inventory.',
    ],
    tips: 'The sum of Grade A + B + C should match the raw intake weight. Grade A unlocks higher marketplace price premiums.',
  },
  {
    id: 'manage-inventory',
    title: 'How to Manage Inventory & Stock Levels',
    category: 'Supply Chain',
    tabId: 'inventory',
    icon: '🏢',
    summary: 'Monitor live warehouse stock levels categorized by crop, grade, reserved, and sold weight.',
    steps: [
      'Click the "Inventory" tab on the main dashboard menu.',
      'View total available stock, reserved stock (under active buyer orders), and sold stock.',
      'Review produce breakdown tables per crop type and grade.',
      'Set or update base selling prices per kg directly on inventory items.',
      'Switch to "FPO Operations > Inventory Aging" to review older lots (5+ days) and dispatch them first.',
    ],
    tips: 'Quantities are automatically marked "Reserved" once orders are placed, preventing stock overselling.',
  },
  {
    id: 'create-listing',
    title: 'How to Create & Publish a Marketplace Listing',
    category: 'Marketplace',
    tabId: 'listings',
    icon: '🏷️',
    summary: 'Publish your graded warehouse produce to the consumer and B2B marketplace to receive buyer orders.',
    steps: [
      'Go to the "Listings" tab.',
      'Click "Create New Listing" or use the listing form.',
      'Select the source graded inventory batch / produce type.',
      'Set your Selling Price (₹/kg) and Available Quantity (kg).',
      'Add high quality produce photos (upload or image URLs).',
      'Add description, harvest date, and farm origin highlights.',
      'Click "Publish Listing" to make the listing live on the FarmFresh marketplace!',
    ],
    tips: 'Check the "Price Intelligence" tab first to compare your proposed listing price against live Agmarknet Mandi rates.',
  },
  {
    id: 'order-fulfillment',
    title: 'How to Accept, Pack, Dispatch & Fulfill Orders',
    category: 'Orders & Sales',
    tabId: 'orders',
    icon: '📦',
    summary: 'Manage orders through every stage of the fulfillment lifecycle.',
    steps: [
      'Open the "Orders" tab to view newly placed buyer orders.',
      'For newly "Placed" orders, click "Accept Order" to confirm inventory allocation.',
      'When sorted and packaged in the warehouse, click "Mark Packed".',
      'When loaded onto transport for dispatch, click "Mark Dispatched".',
      'Once delivered to the buyer location, update status to "Delivered".',
    ],
    tips: 'Funds are securely released to the FPO payout ledger upon successful fulfillment.',
  },
  {
    id: 'farmer-payouts',
    title: 'How to Process Farmer Settlement & Payouts',
    category: 'Finance',
    tabId: 'payouts',
    icon: '💰',
    summary: 'Disburse crop earnings to farmers via Direct Bank Transfer (DBT) or Working Capital Credit Line.',
    steps: [
      'Navigate to the "Payouts" tab.',
      'View the list of pending farmer payouts with amount owed per batch.',
      'Click "Pay Now" on the settlement line.',
      'Select payment source: "Direct Escrow / Bank Transfer" or "FPO Credit Line".',
      'Confirm the payment. Status immediately updates to "Completed" with a verifiable transaction ID.',
    ],
    tips: 'You can generate a consolidated PDF payout statement for accounting from "FPO Operations > Documents".',
  },
  {
    id: 'procurement-plan',
    title: 'How to Create a Forward Procurement Plan',
    category: 'Supply Chain',
    tabId: 'operations',
    icon: '📝',
    summary: 'Set strategic procurement volume and price targets to organize farmer harvesting.',
    steps: [
      'In "FPO Operations", select the "Procurement" sub-tab.',
      'Enter Produce Type (e.g. Tomato, Basmati Rice, Organic Wheat).',
      'Input Required Quantity (kg) and Target Price (₹/kg).',
      'Select the "Required By" target date and add any operational notes.',
      'Click "Create plan". Collection center staff can align daily farmer intake with this plan.',
    ],
    tips: 'Align your procurement plans with Institutional Buyer Demand for locked-in trading margins.',
  },
  {
    id: 'buyer-demand',
    title: 'How to Log Institutional Buyer Demand (B2B / HoReCa)',
    category: 'Marketplace',
    tabId: 'operations',
    icon: '🤝',
    summary: 'Record bulk forward demand contracts from restaurants, processors, retail chains, and wholesalers.',
    steps: [
      'In "FPO Operations", switch to the "Buyer Demand" sub-tab.',
      'Enter Buyer Name and select Buyer Type (Restaurant, Kirana, Wholesaler, Processor, Institution, Other).',
      'Enter Produce Type, Required Quantity (kg), and Target Price (₹/kg).',
      'Set the required Delivery Date and Delivery Location.',
      'Click "Add demand" to post to the open demand board.',
    ],
    tips: 'Use open buyer demand to issue advance procurement notices to member farmers.',
  },
  {
    id: 'logistics-shipments',
    title: 'How to Create & Dispatch Logistics Shipments',
    category: 'Logistics',
    tabId: 'operations',
    icon: '🚚',
    summary: 'Manage transport vehicles, drivers, origin-destination routes, and track in-transit ETAs.',
    steps: [
      'In "FPO Operations", switch to the "Logistics" sub-tab.',
      'Fill in Vehicle Number, Driver Name, Origin location, and Destination location.',
      'Enter Quantity (kg) loaded and estimated Transport Cost (₹).',
      'Set the scheduled arrival time (ETA).',
      'Click "Create shipment". Track progress on the Shipment Board.',
    ],
    tips: 'Command Center action alerts automatically flag any shipment that exceeds its scheduled ETA.',
  },
  {
    id: 'mandi-prices',
    title: 'How to Monitor Live Mandi Price Intelligence',
    category: 'Market Intelligence',
    tabId: 'operations',
    icon: '📈',
    summary: 'Compare FPO listing prices against live Agmarknet / Government Mandi modal rates.',
    steps: [
      'In "FPO Operations", click on the "Price Intelligence" sub-tab.',
      'Inspect the comparison table showing your FPO Listing Price vs Mandi Modal Price.',
      'Check the Difference % column (+% shows your listing commands a premium).',
      'Use these insights to optimize pricing strategy and maximize farmer realization.',
    ],
    tips: 'Mandi prices sync with verified APMC market records.',
  },
  {
    id: 'demand-forecast',
    title: 'How to View 7-Day Demand Forecasts',
    category: 'Market Intelligence',
    tabId: 'operations',
    icon: '🔮',
    summary: 'View 7-day predictive demand estimates computed from 90-day order velocity.',
    steps: [
      'In "FPO Operations", open the "Demand Forecast" sub-tab.',
      'View projected 7-day volume estimates per produce commodity.',
      'Check the 90-day underlying order quantity baseline.',
      'Use this intelligence to schedule harvesting and farmer collection in advance.',
    ],
    tips: 'Forecast calculations update dynamically as new marketplace orders are confirmed.',
  },
  {
    id: 'stock-reconciliation',
    title: 'How to Perform Inventory & Stock Reconciliation',
    category: 'Supply Chain',
    tabId: 'operations',
    icon: '📑',
    summary: 'Audit warehouse inventory against recorded stock intake, reservation, and sales movements.',
    steps: [
      'In "FPO Operations", select the "Reconciliation" sub-tab.',
      'Review the summary: Inventory Issues (variance > 0.1 kg), Pending Payouts, and Total Order Quantity.',
      'Review the table: Expected (Intake - Sold + Adjustments) vs Actual on-hand stock.',
      'A status of "MATCH" confirms mathematical integrity across all stock movements.',
    ],
    tips: 'If any line shows "CHECK", verify physical godown records for unrecorded dispatches or shrinkage.',
  },
  {
    id: 'pdf-documents',
    title: 'How to Generate & Print Official PDF Statements',
    category: 'Reports & Documents',
    tabId: 'operations',
    icon: '🖨️',
    summary: 'Generate standardized, print-ready PDF statements for banks, auditors, and board reviews.',
    steps: [
      'In "FPO Operations", click the "Documents" sub-tab.',
      'Choose the report: Farmer Payout Statement, Inventory Report, Cash Flow Report, or Reconciliation Report.',
      'A print-ready window will launch with formatted tables and totals.',
      'Click "Print / Save as PDF" or press Ctrl+P (Cmd+P) to save the PDF file.',
    ],
    tips: 'All generated FPO reports exclude confidential platform fee margins, making them safe to share with auditors.',
  },
  {
    id: 'traceability-passport',
    title: 'How to View Consumer Traceability Passports',
    category: 'Consumer & Traceability',
    tabId: 'intake',
    icon: '📱',
    summary: 'Verify farm origin, harvest date, cold-chain log, and quality score via digital QR passport.',
    steps: [
      'Scan the QR code printed on the produce packaging or batch sticker.',
      'Or open `/trace/:batchId` directly in your browser.',
      'View the verified farmer name, farm location, harvest date, and quality inspection score.',
    ],
    tips: 'Batch QR codes boost consumer confidence and support higher retail margins.',
  },
  {
    id: 'profile-kyc',
    title: 'How to Update FPO Profile & KYC Details',
    category: 'Profile & Settings',
    tabId: 'settings',
    icon: '⚙️',
    summary: 'Manage FPO legal details, CBBO affiliation, bank accounts, and statutory credentials.',
    steps: [
      'Click on "Profile & KYC" in the main navigation menu.',
      'Update FPO Legal Name, Registration Number, Scheme Name, and Affiliated CBBO.',
      'Review Contact Details, Office Address, State, and District.',
      'Verify Bank Account Details for receiving buyer payments.',
    ],
    tips: 'A "Verified" KYC status unlocks instant working capital credit lines for farmer settlements.',
  },
  {
    id: 'cash-flow-tracker',
    title: 'How to Track Cash Flow & Working Capital',
    category: 'Finance',
    tabId: 'earnings',
    icon: '💵',
    summary: 'See what the marketplace has earned, what you still owe farmers, and whether you can pay them on time.',
    steps: [
      'Click on "Marketplace Earnings" in the main navigation.',
      'Read the alerts at the top. They flag farmer payments overdue by 15 or 30+ days and low cover.',
      'Check the summary cards: marketplace earnings (after refunds), amount paid to farmers, net marketplace cash, amount owed to farmers and credit line headroom.',
      'Use "Owed to farmers, by age" to see how old each unpaid graded batch is, then pay the oldest first from the "Payouts" tab.',
      'In "Can you pay your farmers?", optionally type the cash in your bank account (it is not saved) to see whether you can cover everything owed.',
      'Click "Refresh" to reload the latest figures.',
    ],
    tips: 'These figures come from your FarmFresh records only. Online payments are recorded in the FarmFresh ledger, so confirm them against your bank account.',
  },
  {
    id: 'bank-ready-pack',
    title: 'How to Download the Bank-Ready Data Pack',
    category: 'Finance',
    tabId: 'earnings',
    icon: '🏦',
    summary: 'Create a clean ledger and summary for a bank, your CA or your CBBO for any period.',
    steps: [
      'Click on "Marketplace Earnings" and scroll to "Bank-ready data pack".',
      'Choose the period: this financial year, last financial year, last 6 or 12 months, or custom dates.',
      'Click "Open printable report (PDF)", then use "Print / Save as PDF" in the new tab.',
      'Or click "Download ledger (CSV for Excel)" for a dated list of every receipt, refund and farmer payout.',
      'Share the file with your bank, CA or CBBO.',
    ],
    tips: 'Farmer names are left out and payees appear as member IDs. The pack says it is unaudited and not reconciled with bank statements, so keep your bank statements ready too.',
  },
  {
    id: 'compliance-tracker',
    title: 'How to Track Statutory & Governance Compliance',
    category: 'Compliance',
    tabId: 'completion',
    icon: '📋',
    summary: 'Keep track of audits, meetings, filings and licences so nothing that affects scheme eligibility or bank loans is missed.',
    steps: [
      'Click on "Compliance" in the main navigation. The tracker is at the top of the page.',
      'FPO admins: click "Add the standard checklist" to add the common FPO tasks. They come without dates.',
      'Ask your CA or Company Secretary for each due date, then set it with the date picker on the task. FarmFresh does not guess deadlines.',
      'Update the status as you go: Pending, In progress, Completed or Not applicable. Use "Notes" for who is responsible or a filing reference.',
      'Watch the Overdue and Due in 30 days counters, and use the filters to see what needs attention.',
      'Use "Add your own task" for anything specific to your FPO.',
    ],
    tips: 'Staff can view the tracker but only the FPO admin can change it. Open compliance tasks also appear in the bank-ready data pack.',
  },
];

// Navigation Categories for clean structured layout
const NAV_CATEGORIES = [
  {
    id: 'executive',
    label: 'Overview & Finance',
    icon: '📊',
    tabs: [
      { id: 'command', label: 'Command Center', icon: '⚡' },
      { id: 'cash', label: 'Cash Flow', icon: '💵' },
      { id: 'farmers', label: 'Farmer Settlement', icon: '🌾' },
      { id: 'profit', label: 'Profitability', icon: '📈' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations & Supply Chain',
    icon: '📦',
    tabs: [
      { id: 'inventory', label: 'Inventory Aging', icon: '🏬' },
      { id: 'procurement', label: 'Procurement Plans', icon: '📝' },
      { id: 'logistics', label: 'Logistics & Fleet', icon: '🚚' },
      { id: 'quality', label: 'Quality Intelligence', icon: '✨' },
    ],
  },
  {
    id: 'market',
    label: 'Market & Intelligence',
    icon: '🌐',
    tabs: [
      { id: 'buyers', label: 'Institutional Demand', icon: '🤝' },
      { id: 'prices', label: 'Price Intelligence', icon: '🏷️' },
      { id: 'forecast', label: 'Demand Forecast', icon: '🔮' },
      { id: 'geo', label: 'Geography & Clusters', icon: '📍' },
    ],
  },
  {
    id: 'tools',
    label: 'Intelligence & Tools',
    icon: '🤖',
    tabs: [
      { id: 'assistant', label: 'AI Operations Guide', icon: '🤖', highlight: true },
      { id: 'reconcile', label: 'Reconciliation', icon: '📑' },
      { id: 'documents', label: 'Automated Documents', icon: '🖨️' },
    ],
  },
];

export default function FpoOperationsCenter({ onNavigateTab }) {
  const [data, setData] = useState(null);
  const [prices, setPrices] = useState([]);
  const [tab, setTab] = useState('command');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [question, setQuestion] = useState('');
  const [assistantResult, setAssistantResult] = useState(null);
  const [forms, setForms] = useState({ procurement: {}, demand: {}, shipment: {} });
  const [expandedOpId, setExpandedOpId] = useState(null);
  const [opCategoryFilter, setOpCategoryFilter] = useState('All');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [s, p] = await Promise.all([
        API.get('/fpo-operations/summary'),
        API.get('/fpo-operations/prices').catch(() => ({ data: { prices: [] } })),
      ]);
      setData(s.data);
      setPrices(p.data?.prices || []);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not load FPO operations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (msg, bad = false) => {
    if (bad) setError(msg);
    else setMessage(msg);
    setTimeout(() => {
      setMessage('');
      setError('');
    }, 3500);
  };

  const setForm = (section, key, value) => setForms((x) => ({ ...x, [section]: { ...x[section], [key]: value } }));

  const submit = async (url, section, successText) => {
    setSaving(true);
    setError('');
    try {
      await API.post(url, forms[section]);
      setForms((x) => ({ ...x, [section]: {} }));
      flash(successText);
      await load();
    } catch (e) {
      flash(e.response?.data?.message || 'Save failed.', true);
    } finally {
      setSaving(false);
    }
  };

  const handleAskQuestion = async (queryText) => {
    const q = (queryText || question).trim();
    if (!q) return;
    setQuestion(q);
    setSaving(true);

    // Fast local match for operations guide
    const lowerQ = q.toLowerCase();
    const localMatch = OPERATIONS_GUIDE.find((op) =>
      op.id.includes(lowerQ) ||
      op.title.toLowerCase().includes(lowerQ) ||
      op.summary.toLowerCase().includes(lowerQ) ||
      lowerQ.includes(op.category.toLowerCase()) ||
      (op.id === 'add-farmer' && (lowerQ.includes('farmer') || lowerQ.includes('kisan') || lowerQ.includes('register'))) ||
      (op.id === 'intake-batch' && (lowerQ.includes('intake') || lowerQ.includes('batch') || lowerQ.includes('harvest'))) ||
      (op.id === 'grading-quality' && (lowerQ.includes('grade') || lowerQ.includes('grading') || lowerQ.includes('quality'))) ||
      (op.id === 'manage-inventory' && (lowerQ.includes('inventory') || lowerQ.includes('stock'))) ||
      (op.id === 'create-listing' && (lowerQ.includes('listing') || lowerQ.includes('sell') || lowerQ.includes('marketplace'))) ||
      (op.id === 'order-fulfillment' && (lowerQ.includes('order') || lowerQ.includes('fulfill') || lowerQ.includes('dispatch order') || lowerQ.includes('deliver'))) ||
      (op.id === 'farmer-payouts' && (lowerQ.includes('payout') || lowerQ.includes('settle') || lowerQ.includes('pay farmer') || lowerQ.includes('payment'))) ||
      (op.id === 'procurement-plan' && (lowerQ.includes('procure') || lowerQ.includes('procurement'))) ||
      (op.id === 'buyer-demand' && (lowerQ.includes('buyer') || lowerQ.includes('b2b') || lowerQ.includes('demand'))) ||
      (op.id === 'logistics-shipments' && (lowerQ.includes('shipment') || lowerQ.includes('truck') || lowerQ.includes('vehicle') || lowerQ.includes('logistics') || lowerQ.includes('transport'))) ||
      (op.id === 'mandi-prices' && (lowerQ.includes('mandi') || lowerQ.includes('price') || lowerQ.includes('agmarknet'))) ||
      (op.id === 'demand-forecast' && (lowerQ.includes('forecast') || lowerQ.includes('predict'))) ||
      (op.id === 'stock-reconciliation' && (lowerQ.includes('reconcil') || lowerQ.includes('mismatch') || lowerQ.includes('audit stock'))) ||
      (op.id === 'pdf-documents' && (lowerQ.includes('pdf') || lowerQ.includes('document') || lowerQ.includes('print') || lowerQ.includes('statement') || lowerQ.includes('report'))) ||
      (op.id === 'cash-flow-tracker' && (lowerQ.includes('cash flow') || lowerQ.includes('working capital') || lowerQ.includes('earnings') || lowerQ.includes('owed to farmers') || lowerQ.includes('can we pay'))) ||
      (op.id === 'bank-ready-pack' && (lowerQ.includes('bank') || lowerQ.includes('ledger') || lowerQ.includes('data pack') || lowerQ.includes('loan'))) ||
      (op.id === 'compliance-tracker' && (lowerQ.includes('compliance') || lowerQ.includes('agm') || lowerQ.includes('statutory') || lowerQ.includes('annual return') || lowerQ.includes('filing'))) ||
      (op.id === 'traceability-passport' && (lowerQ.includes('trace') || lowerQ.includes('qr') || lowerQ.includes('passport')))
    );

    try {
      const r = await API.post('/fpo-operations/assistant', { question: q });
      const resData = r.data;

      if (resData.type === 'OPERATION' && resData.operation) {
        setAssistantResult({
          type: 'OPERATION',
          operation: resData.operation,
          answer: resData.answer,
        });
      } else if (resData.type === 'METRIC') {
        setAssistantResult({
          type: 'METRIC',
          answer: resData.answer,
        });
      } else if (localMatch) {
        setAssistantResult({
          type: 'OPERATION',
          operation: localMatch,
          answer: `Here is the complete step-by-step guide on ${localMatch.title}.`,
        });
      } else {
        setAssistantResult({
          type: 'GENERAL',
          answer: resData.answer || 'I am ready to help you with any software operation or data enquiry.',
        });
      }
    } catch {
      if (localMatch) {
        setAssistantResult({
          type: 'OPERATION',
          operation: localMatch,
          answer: `Here is the complete step-by-step guide on ${localMatch.title}.`,
        });
      } else {
        flash('Could not reach assistant backend, showing built-in guides.', false);
      }
    } finally {
      setSaving(false);
    }
  };

  const printDocument = async (type) => {
    try {
      const r = await API.get(`/fpo-operations/documents/${type}`);
      const d = r.data;
      const rows = Array.isArray(d.rows) ? d.rows : [];
      const tableRows = rows.map((row) => `<tr>${Object.values(row).map((v) => `<td>${String(v ?? '—')}</td>`).join('')}</tr>`).join('');
      const headings = rows[0] ? Object.keys(rows[0]).map((k) => `<th>${k}</th>`).join('') : '';
      const totals = d.totals ? `<div class="totals">${Object.entries(d.totals).map(([k, v]) => `<b>${k}:</b> ${v}`).join(' &nbsp; | &nbsp; ')}</div>` : '';
      const win = window.open('', '_blank');
      if (!win) {
        flash('Allow pop-ups to generate the document.', true);
        return;
      }
      win.document.write(`<!doctype html><html><head><title>${d.title}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#172033}h1{font-size:22px;margin-bottom:4px}p{color:#64748b;margin-top:0}.totals{padding:14px;background:#f1f5f9;margin:16px 0;border-radius:6px}table{border-collapse:collapse;width:100%;font-size:12px;margin-top:12px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}th{background:#f8fafc;font-weight:600}@media print{button{display:none}}button{margin-top:20px;padding:10px 18px;background:#0f172a;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600}</style></head><body><h1>${d.title}</h1><p>${d.fpo?.name || 'FPO'} · Generated ${new Date(d.generatedAt).toLocaleString('en-IN')}</p>${totals}<table><thead><tr>${headings}</tr></thead><tbody>${tableRows}</tbody></table><button onclick="window.print()">Print / Save as PDF</button></body></html>`);
      win.document.close();
    } catch {
      flash('Document generation failed.', true);
    }
  };

  const summary = data || {};
  const farmersPending = summary?.commandCenter || {};

  const allTabs = useMemo(() => {
    const list = [];
    NAV_CATEGORIES.forEach((cat) => cat.tabs.forEach((t) => list.push({ ...t, category: cat.label })));
    return list;
  }, []);

  const visibleTabs = useMemo(() => {
    if (selectedCategory === 'all') return allTabs;
    const cat = NAV_CATEGORIES.find((c) => c.id === selectedCategory);
    return cat ? cat.tabs : allTabs;
  }, [selectedCategory, allTabs]);

  const filteredOperations = useMemo(() => {
    if (opCategoryFilter === 'All') return OPERATIONS_GUIDE;
    return OPERATIONS_GUIDE.filter((op) => op.category === opCategoryFilter);
  }, [opCategoryFilter]);

  if (loading && !data) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center text-slate-500 shadow-sm">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-emerald-600 mb-3" />
        <p className="font-medium text-slate-700">Loading FPO Command Center…</p>
        <p className="text-xs text-slate-400 mt-1">Aggregating live operations, inventory, and market intelligence</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">⚠️ {error}</div>}
      {message && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-sm flex items-center gap-2">✅ {message}</div>}

      {/* Hero Command Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-2xl p-6 lg:p-7 shadow-lg border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                FPO Operating System
              </span>
              <span className="text-xs text-slate-400">· Real-Time Operational Intelligence</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-bold mt-2 text-white">
              {summary.fpo?.name || 'FPO'} Command Center
            </h2>
            <p className="text-slate-300 text-sm mt-1.5 max-w-2xl">
              Complete command of farmer settlements, live inventory aging, logistics fleet, institutional demand, and Mandi price intelligence.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setTab('assistant')}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-xl px-4 py-2.5 text-sm transition-all shadow-md flex items-center gap-2"
            >
              🤖 Ask AI Assistant
            </button>
            <button
              className="bg-white/10 hover:bg-white/20 text-white rounded-xl px-4 py-2.5 text-sm font-medium border border-white/10 transition-all flex items-center gap-2"
              onClick={load}
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Categorized Clean Navigation Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-3 shadow-sm space-y-3">
        {/* Category Pill Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-100">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2">Sections:</span>
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Modules ({allTabs.length})
          </button>
          {NAV_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                selectedCategory === cat.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Action Tabs in Selected Section */}
        <div className="flex flex-wrap gap-2 pt-1">
          {visibleTabs.map((t) => {
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-all flex items-center gap-2 ${
                  isActive
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm ring-2 ring-emerald-600/20'
                    : t.highlight
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 font-semibold'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
                {t.highlight && !isActive && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB: COMMAND CENTER (OVERVIEW) */}
      {tab === 'command' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Active Farmers"
              value={farmersPending.activeFarmers || 0}
              sub={`${farmersPending.farmers || 0} total registered`}
              icon="🌾"
              color="emerald"
            />
            <Stat
              label="Total Inventory"
              value={kg(farmersPending.inventoryKg)}
              sub={`${kg(farmersPending.reservedKg)} reserved for orders`}
              icon="🏬"
              color="blue"
            />
            <Stat
              label="Pending Orders"
              value={farmersPending.pendingOrders || 0}
              sub={`${farmersPending.orders || 0} lifetime orders`}
              icon="📦"
              color="amber"
            />
            <Stat
              label="Shipments in Transit"
              value={farmersPending.shipmentsInTransit || 0}
              sub="Active fleet logistics"
              icon="🚚"
              color="indigo"
            />
          </div>

          <Card title="Operational Action Alerts" subtitle="Prioritized alerts requiring management review or action">
            <div className="space-y-2.5">
              {(summary.alerts || []).length ? (
                summary.alerts.map((a, i) => (
                  <div
                    key={i}
                    className={`rounded-xl border p-4 text-sm flex items-start justify-between gap-3 ${
                      a.severity === 'HIGH'
                        ? 'bg-red-50/80 border-red-200 text-red-900'
                        : 'bg-amber-50/80 border-amber-200 text-amber-900'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        a.severity === 'HIGH' ? 'bg-red-200 text-red-900' : 'bg-amber-200 text-amber-900'
                      }`}>
                        {a.severity}
                      </span>
                      <div>
                        <p className="font-semibold">{a.message}</p>
                        <p className="text-xs opacity-75 mt-0.5">Category: {a.type}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <Empty text="All operations normal. No action alerts right now." icon="✅" />
              )}
            </div>
          </Card>

          {/* Quick Shortcuts */}
          <div className="grid sm:grid-cols-3 gap-4">
            <div
              onClick={() => setTab('assistant')}
              className="bg-gradient-to-br from-emerald-50 to-emerald-100/60 border border-emerald-200 rounded-2xl p-5 cursor-pointer hover:shadow-md transition-all"
            >
              <div className="text-2xl mb-2">🤖</div>
              <h4 className="font-semibold text-emerald-950 text-sm">Need Help with Any Operation?</h4>
              <p className="text-xs text-emerald-700 mt-1">Ask the AI Assistant for step-by-step guides on any software workflow.</p>
            </div>
            <div
              onClick={() => setTab('procurement')}
              className="bg-gradient-to-br from-slate-50 to-slate-100/60 border border-slate-200 rounded-2xl p-5 cursor-pointer hover:shadow-md transition-all"
            >
              <div className="text-2xl mb-2">📝</div>
              <h4 className="font-semibold text-slate-900 text-sm">Create Procurement Plan</h4>
              <p className="text-xs text-slate-600 mt-1">Set intake quantity and target buy prices for member farmers.</p>
            </div>
            <div
              onClick={() => setTab('prices')}
              className="bg-gradient-to-br from-blue-50 to-blue-100/60 border border-blue-200 rounded-2xl p-5 cursor-pointer hover:shadow-md transition-all"
            >
              <div className="text-2xl mb-2">🏷️</div>
              <h4 className="font-semibold text-blue-950 text-sm">Check Live Mandi Prices</h4>
              <p className="text-xs text-blue-700 mt-1">Compare FPO marketplace rates with Government Mandi modal benchmarks.</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB: CASH FLOW */}
      {tab === 'cash' && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Stat label="Money to Receive" value={money(summary.cashFlow?.moneyToReceive)} sub="FPO share from completed orders" icon="📥" />
            <Stat label="Money to Pay" value={money(summary.cashFlow?.moneyToPay)} sub="Pending farmer payouts" icon="📤" />
            <Stat label="Net Operating Position" value={money(summary.cashFlow?.netPosition)} sub="Receivables minus payables" icon="⚖️" />
            <Stat label="Credit Line Used" value={money(summary.cashFlow?.creditUsed)} sub={`${summary.cashFlow?.creditUtilizationPct || 0}% utilization`} icon="💳" />
          </div>

          <Card title="Working Capital Credit Line" subtitle="Institutional credit support for immediate farmer settlements">
            <div className="grid md:grid-cols-3 gap-4">
              <Stat label="Credit Limit" value={money(summary.cashFlow?.creditLimit)} />
              <Stat label="Utilized Amount" value={money(summary.cashFlow?.creditUsed)} />
              <Stat label="Available Balance" value={money(summary.cashFlow?.creditAvailable)} color="emerald" />
            </div>
            <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
              💡 <b>Note:</b> Working capital credit lines allow instant farmer DBT payments upon batch intake before buyer marketplace settlement concludes. Platform fee earnings are excluded from FPO views.
            </div>
          </Card>
        </div>
      )}

      {/* TAB: FARMER SETTLEMENT */}
      {tab === 'farmers' && (
        <Card title="Farmer Settlement Obligation Control" subtitle="Consolidated obligation overview for member payouts">
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Stat label="Pending Payouts" value={summary.cashFlow?.pendingPayouts || 0} sub="Unsettled farmer batches" icon="⏳" />
            <Stat label="Amount Due" value={money(summary.cashFlow?.moneyToPay)} sub="Gross payable amount" icon="💵" />
            <Stat label="FPO Farmers" value={summary.commandCenter?.farmers || 0} sub="Shareholders & members" icon="👥" />
            <Stat label="Active Suppliers" value={summary.commandCenter?.activeFarmers || 0} sub="Delivered in last 90d" icon="🌾" />
          </div>
          <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="font-semibold text-emerald-950 text-sm">Ready to disburse payments?</p>
              <p className="text-xs text-emerald-700">Navigate to the Payouts module to trigger individual DBT or bulk credit line transfers.</p>
            </div>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('payouts')}
                className="bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg px-4 py-2 text-xs font-semibold shadow-sm transition-all"
              >
                Go to Payouts Tab →
              </button>
            )}
          </div>
        </Card>
      )}

      {/* TAB: INVENTORY AGING */}
      {tab === 'inventory' && (
        <div className="space-y-6">
          <Card title="Intake Inventory Aging Breakdown" subtitle="Batch age tracking from harvest date to reduce spoilage risk">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(summary.commandCenter?.inventoryAging || {}).map(([bucket, val]) => (
                <Stat
                  key={bucket}
                  label={`Age: ${bucket}`}
                  value={kg(val)}
                  sub={bucket === '5+ days' ? '⚠️ High spoilage priority' : 'Fresh stock'}
                  color={bucket === '5+ days' ? 'red' : 'emerald'}
                />
              ))}
            </div>
          </Card>
          <Card title="Stock Management Best Practice">
            <p className="text-sm text-slate-600 leading-relaxed">
              Older lots (4-5 days and 5+ days) are flagged so your team can prioritize order fulfillment, processing, or controlled markdown before quality degradation occurs.
            </p>
          </Card>
        </div>
      )}

      {/* TAB: PROCUREMENT PLANS */}
      {tab === 'procurement' && (
        <div className="space-y-6">
          <Card title="Create New Procurement Plan" subtitle="Set target produce intake requirements and price caps">
            <form
              className="grid md:grid-cols-6 gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                submit('/fpo-operations/procurement-plans', 'procurement', 'Procurement plan created.');
              }}
            >
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Produce Name *</label>
                <input
                  className={input}
                  required
                  placeholder="e.g. Organic Wheat, Red Onions"
                  value={forms.procurement.produceType || ''}
                  onChange={(e) => setForm('procurement', 'produceType', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Target Qty (kg) *</label>
                <input
                  className={input}
                  required
                  type="number"
                  min="0.1"
                  step="0.1"
                  placeholder="e.g. 500"
                  value={forms.procurement.requiredQuantityKg || ''}
                  onChange={(e) => setForm('procurement', 'requiredQuantityKg', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Target Price (₹/kg)</label>
                <input
                  className={input}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 28.50"
                  value={forms.procurement.targetPricePerKg || ''}
                  onChange={(e) => setForm('procurement', 'targetPricePerKg', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Required By *</label>
                <input
                  className={input}
                  required
                  type="date"
                  value={forms.procurement.requiredBy || ''}
                  onChange={(e) => setForm('procurement', 'requiredBy', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
                <input
                  className={input}
                  placeholder="e.g. Grade A only"
                  value={forms.procurement.notes || ''}
                  onChange={(e) => setForm('procurement', 'notes', e.target.value)}
                />
              </div>
              <button
                className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl px-4 py-2.5 text-sm font-semibold md:col-span-6 transition-all shadow-sm disabled:opacity-50"
                disabled={saving}
              >
                + Create Procurement Plan
              </button>
            </form>
          </Card>

          <Card title="Active Procurement Plans" subtitle="Open crop targets for intake coordination">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-3 text-left font-semibold text-slate-700">Produce</th>
                    <th className="p-3 text-left font-semibold text-slate-700">Required Qty</th>
                    <th className="p-3 text-left font-semibold text-slate-700">Target Price</th>
                    <th className="p-3 text-left font-semibold text-slate-700">Required By</th>
                    <th className="p-3 text-left font-semibold text-slate-700">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(summary.procurementPlans || []).map((x) => (
                    <tr key={x._id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-medium text-slate-900">{x.produceType}</td>
                      <td className="p-3">{kg(x.requiredQuantityKg)}</td>
                      <td className="p-3">{x.targetPricePerKg ? `${money(x.targetPricePerKg)}/kg` : 'Market rate'}</td>
                      <td className="p-3">{date(x.requiredBy)}</td>
                      <td className="p-3">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {x.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!(summary.procurementPlans || []).length && (
                    <tr>
                      <td colSpan="5">
                        <Empty text="No open procurement plans right now." />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB: INSTITUTIONAL BUYER DEMAND */}
      {tab === 'buyers' && (
        <div className="space-y-6">
          <Card title="Record Institutional Buyer Demand (B2B / HoReCa)" subtitle="Log bulk contract demand from retail chains, processors, or restaurants">
            <form
              className="grid md:grid-cols-4 gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                submit('/fpo-operations/buyer-demands', 'demand', 'Buyer demand created.');
              }}
            >
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Buyer Organization *</label>
                <input
                  className={input}
                  required
                  placeholder="e.g. FreshBites Hotel"
                  value={forms.demand.buyerName || ''}
                  onChange={(e) => setForm('demand', 'buyerName', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Buyer Type</label>
                <select
                  className={input}
                  value={forms.demand.buyerType || 'OTHER'}
                  onChange={(e) => setForm('demand', 'buyerType', e.target.value)}
                >
                  {['RESTAURANT', 'KIRANA', 'WHOLESALER', 'PROCESSOR', 'INSTITUTION', 'OTHER'].map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Produce Required *</label>
                <input
                  className={input}
                  required
                  placeholder="e.g. Tomatoes"
                  value={forms.demand.produceType || ''}
                  onChange={(e) => setForm('demand', 'produceType', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Quantity (kg) *</label>
                <input
                  className={input}
                  required
                  type="number"
                  min="0.1"
                  step="0.1"
                  placeholder="e.g. 1000"
                  value={forms.demand.quantityKg || ''}
                  onChange={(e) => setForm('demand', 'quantityKg', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Target Price (₹/kg)</label>
                <input
                  className={input}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 35.00"
                  value={forms.demand.targetPricePerKg || ''}
                  onChange={(e) => setForm('demand', 'targetPricePerKg', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Delivery Date *</label>
                <input
                  className={input}
                  required
                  type="date"
                  value={forms.demand.deliveryDate || ''}
                  onChange={(e) => setForm('demand', 'deliveryDate', e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Delivery Location</label>
                <input
                  className={input}
                  placeholder="e.g. Warehouse 4, Pune"
                  value={forms.demand.deliveryLocation || ''}
                  onChange={(e) => setForm('demand', 'deliveryLocation', e.target.value)}
                />
              </div>
              <button
                className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl px-4 py-2.5 text-sm font-semibold md:col-span-4 transition-all shadow-sm disabled:opacity-50"
                disabled={saving}
              >
                + Add Buyer Demand
              </button>
            </form>
          </Card>

          <Card title="Open Buyer Demands" subtitle="Confirmed institutional buyer requirements awaiting fulfillment">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-3 text-left font-semibold text-slate-700">Buyer</th>
                    <th className="p-3 text-left font-semibold text-slate-700">Produce</th>
                    <th className="p-3 text-left font-semibold text-slate-700">Quantity</th>
                    <th className="p-3 text-left font-semibold text-slate-700">Target Delivery</th>
                    <th className="p-3 text-left font-semibold text-slate-700">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(summary.buyerDemands || []).map((x) => (
                    <tr key={x._id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-medium text-slate-900">{x.buyerName} ({x.buyerType})</td>
                      <td className="p-3">{x.produceType}</td>
                      <td className="p-3">{kg(x.quantityKg)}</td>
                      <td className="p-3">{date(x.deliveryDate)}</td>
                      <td className="p-3">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                          {x.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!(summary.buyerDemands || []).length && (
                    <tr>
                      <td colSpan="5">
                        <Empty text="No open buyer demands logged yet." />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB: PROFITABILITY */}
      {tab === 'profit' && (
        <Card title="Estimated Trading Contribution" subtitle="Operational gross contribution before fixed administrative overheads">
          <div className="text-4xl font-extrabold text-slate-900 tracking-tight my-2">
            {money(summary.profitability?.estimatedContributionBeforeOverhead)}
          </div>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl mt-4 text-xs text-slate-600 leading-relaxed">
            <b>Methodology:</b> {summary.profitability?.methodology}
          </div>
        </Card>
      )}

      {/* TAB: PRICE INTELLIGENCE */}
      {tab === 'prices' && (
        <Card title="Live Mandi Price Intelligence" subtitle="Real-time comparison of FPO listing prices against Agmarknet Mandi benchmarks">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="p-3 text-left font-semibold text-slate-700">Produce Type</th>
                  <th className="p-3 text-left font-semibold text-slate-700">FPO Listing (Avg)</th>
                  <th className="p-3 text-left font-semibold text-slate-700">Mandi Modal Rate</th>
                  <th className="p-3 text-left font-semibold text-slate-700">Price Spread</th>
                  <th className="p-3 text-left font-semibold text-slate-700">Benchmark Market / Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prices.map((x) => (
                  <tr key={x.produceType} className="hover:bg-slate-50/50">
                    <td className="p-3 font-semibold text-slate-900">{x.produceType}</td>
                    <td className="p-3 font-medium">{money(x.listingPricePerKg)}/kg</td>
                    <td className="p-3 text-slate-600">{money(x.mandiModalPricePerKg)}/kg</td>
                    <td className="p-3">
                      {x.differencePct == null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          x.differencePct > 0
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {x.differencePct > 0 ? `+${x.differencePct.toFixed(1)}% premium` : `${x.differencePct.toFixed(1)}% discount`}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-slate-500">
                      {x.market || 'Regional APMC'} {x.state ? `(${x.state})` : ''} · {date(x.priceDate)}
                    </td>
                  </tr>
                ))}
                {!prices.length && (
                  <tr>
                    <td colSpan="5">
                      <Empty text="Publish a listing and sync mandi prices to see live intelligence." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB: DEMAND FORECAST */}
      {tab === 'forecast' && (
        <Card title="7-Day Predictive Demand Forecast" subtitle="Calculated from trailing 90-day marketplace order run rate">
          <div className="grid gap-3.5 mt-2">
            {(summary.demandForecast || []).map((x) => (
              <div
                key={x.produceType}
                className="border border-slate-200/80 rounded-xl p-4.5 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4"
              >
                <div>
                  <h4 className="font-bold text-slate-900 text-base">{x.produceType}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    90-Day Cumulative Demand: <b>{kg(x.quantityKg)}</b> across {x.orders} recorded orders
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-xl">
                    ~{kg(x.forecast7dKg)} <span className="text-xs font-normal text-emerald-600">/ next 7 days</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Avg daily: {kg(x.avgDailyKg90d)}</p>
                </div>
              </div>
            ))}
            {!(summary.demandForecast || []).length && (
              <Empty text="Not enough marketplace order history for a 7-day forecast yet." />
            )}
          </div>
        </Card>
      )}

      {/* TAB: LOGISTICS */}
      {tab === 'logistics' && (
        <div className="space-y-6">
          <Card title="Create New Logistics Shipment" subtitle="Dispatch vehicle, assign driver, and log transport costs">
            <form
              className="grid md:grid-cols-4 gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                submit('/fpo-operations/shipments', 'shipment', 'Shipment created.');
              }}
            >
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Vehicle Number *</label>
                <input
                  className={input}
                  required
                  placeholder="e.g. MH 12 AB 1234"
                  value={forms.shipment.vehicleNumber || ''}
                  onChange={(e) => setForm('shipment', 'vehicleNumber', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Driver Name</label>
                <input
                  className={input}
                  placeholder="e.g. Ramesh Kumar"
                  value={forms.shipment.driverName || ''}
                  onChange={(e) => setForm('shipment', 'driverName', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Origin Location *</label>
                <input
                  className={input}
                  required
                  placeholder="e.g. Nashik Godown 1"
                  value={forms.shipment.origin || ''}
                  onChange={(e) => setForm('shipment', 'origin', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Destination Location *</label>
                <input
                  className={input}
                  required
                  placeholder="e.g. Mumbai APMC Market"
                  value={forms.shipment.destination || ''}
                  onChange={(e) => setForm('shipment', 'destination', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Dispatched Qty (kg) *</label>
                <input
                  className={input}
                  required
                  type="number"
                  min="0.1"
                  step="0.1"
                  placeholder="e.g. 750"
                  value={forms.shipment.quantityKg || ''}
                  onChange={(e) => setForm('shipment', 'quantityKg', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Transport Cost (₹)</label>
                <input
                  className={input}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 2400"
                  value={forms.shipment.transportCost || ''}
                  onChange={(e) => setForm('shipment', 'transportCost', e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Expected Arrival (ETA)</label>
                <input
                  className={input}
                  type="datetime-local"
                  value={forms.shipment.eta || ''}
                  onChange={(e) => setForm('shipment', 'eta', e.target.value)}
                />
              </div>
              <button
                className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl px-4 py-2.5 text-sm font-semibold md:col-span-4 transition-all shadow-sm disabled:opacity-50"
                disabled={saving}
              >
                + Create & Dispatch Shipment
              </button>
            </form>
          </Card>

          <Card title="Live Logistics & Shipment Board" subtitle="Real-time transit status and arrival tracking">
            <div className="grid gap-3">
              {(summary.shipments || []).map((x) => (
                <div
                  key={x._id}
                  className="border border-slate-200/80 rounded-xl p-4 bg-white flex flex-wrap items-center justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-100 text-lg">🚚</div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        {x.origin || 'Origin'} → {x.destination || 'Destination'}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        <b>{kg(x.quantityKg)}</b> · Vehicle: {x.vehicleNumber || 'Not set'} · Driver: {x.driverName || 'Not assigned'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      x.status === 'DELIVERED'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-blue-50 text-blue-800 border border-blue-200'
                    }`}>
                      {x.status}
                    </span>
                    <p className="text-xs text-slate-500 mt-1">ETA: {date(x.eta)}</p>
                  </div>
                </div>
              ))}
              {!(summary.shipments || []).length && (
                <Empty text="No active shipments recorded." />
              )}
            </div>
          </Card>
        </div>
      )}

      {/* TAB: QUALITY INTELLIGENCE */}
      {tab === 'quality' && (
        <Card title="Quality Grading Intelligence" subtitle="Quality scores and Grade-A percentage breakdown across intake streams">
          <div className="grid gap-4 mt-2">
            {(summary.quality || []).map((x) => (
              <div key={x.produceType} className="border border-slate-200/80 rounded-xl p-4 bg-slate-50/50">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-slate-900">{x.produceType}</span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Avg Score: {x.avgQualityScore.toFixed(1)} / 100
                  </span>
                </div>
                <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all"
                    style={{ width: `${Math.min(100, x.gradeAPct)}%` }}
                  />
                </div>
                <div className="flex flex-wrap justify-between text-xs text-slate-600 mt-2.5 pt-2 border-t border-slate-200/60">
                  <span>Grade A: <b>{x.gradeAPct.toFixed(1)}%</b> ({kg(x.gradeA)})</span>
                  <span>Grade B: {kg(x.gradeB)}</span>
                  <span>Grade C: {kg(x.gradeC)}</span>
                  <span>Total Intake: <b>{kg(x.intakeKg)}</b></span>
                </div>
              </div>
            ))}
            {!(summary.quality || []).length && (
              <Empty text="Grade intake batches to build quality intelligence." />
            )}
          </div>
        </Card>
      )}

      {/* TAB: GEOGRAPHY */}
      {tab === 'geo' && (
        <Card title="Farmer Geographic Clusters" subtitle="Member farmer aggregation by district, state, and cultivated land">
          <div className="grid gap-4 md:grid-cols-2 mt-2">
            {(summary.geographicClusters || []).map((x) => (
              <div key={x.location} className="border border-slate-200/80 rounded-xl p-4 bg-white shadow-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-sm">📍 {x.location}</h4>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 font-semibold text-slate-700">
                    {x.farmers} farmers ({x.active} active)
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  Total Land: <b>{x.landAcres.toFixed(1)} acres</b>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Key Crops: {x.produceTypes.join(', ') || 'Various'}
                </p>
              </div>
            ))}
            {!(summary.geographicClusters || []).length && (
              <Empty text="No farmer geographic cluster data available yet." />
            )}
          </div>
        </Card>
      )}

      {/* TAB: AI ASSISTANT (SUPERCHARGED SMART GUIDE) */}
      {tab === 'assistant' && (
        <div className="space-y-6">
          {/* Hero Assistant Bar */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white rounded-2xl p-6 shadow-md border border-slate-800 relative overflow-hidden">
            <div className="flex items-start gap-4">
              <div className="p-3.5 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl text-2xl">
                🤖
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-white">FarmFresh Smart Operations Assistant</h3>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-emerald-500 text-slate-950 rounded-md">
                    24/7 Guide
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                  Ask how to perform any operation in the software (e.g. adding farmers, intake, grading, listings, payouts, shipments) or ask real-time data questions.
                </p>

                {/* Question Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAskQuestion();
                  }}
                  className="mt-4 flex gap-2"
                >
                  <input
                    className="flex-1 bg-white text-slate-900 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 font-medium placeholder-slate-400 shadow-inner"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="e.g. How to register a farmer? or How much do we owe farmers?"
                  />
                  <button
                    type="submit"
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-3 rounded-xl text-sm transition-all shadow-md disabled:opacity-50 flex items-center gap-2 shrink-0"
                    disabled={saving}
                  >
                    {saving ? 'Thinking…' : 'Ask Guide'}
                  </button>
                </form>

                {/* Quick Prompts */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">Quick Prompts:</span>
                  {[
                    'How to add farmer?',
                    'How to record intake & batch?',
                    'How to do grading?',
                    'How to create listing?',
                    'How to process payouts?',
                    'How to create shipment?',
                    'How much do we owe farmers?',
                    'Can we cover farmer payments?',
                    'Any compliance tasks overdue?',
                    'How to print PDF report?',
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleAskQuestion(chip)}
                      className="text-[11px] bg-white/10 hover:bg-white/20 text-emerald-200 border border-white/10 rounded-lg px-2.5 py-1 transition-all"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* AI Response Card */}
          {assistantResult && (
            <Card
              title={
                assistantResult.type === 'OPERATION' && assistantResult.operation
                  ? assistantResult.operation.title
                  : 'Assistant Response'
              }
              badge={
                assistantResult.type === 'OPERATION'
                  ? 'Step-by-Step Operation Guide'
                  : assistantResult.type === 'METRIC'
                  ? 'Live Operational Metric'
                  : 'Assistant Intelligence'
              }
              action={
                assistantResult.type === 'OPERATION' && assistantResult.operation && onNavigateTab && (
                  <button
                    onClick={() => onNavigateTab(assistantResult.operation.tabId)}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-sm transition-all flex items-center gap-1.5"
                  >
                    Open {assistantResult.operation.category} Tab →
                  </button>
                )
              }
            >
              {assistantResult.type === 'OPERATION' && assistantResult.operation ? (
                <div className="space-y-4">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
                    <p className="font-semibold text-slate-900 text-sm mb-1">{assistantResult.operation.summary}</p>
                    <p className="text-slate-500">
                      Module Location: <b>{assistantResult.operation.category}</b> (Tab: <code className="bg-slate-200/80 px-1.5 py-0.5 rounded text-[11px]">{assistantResult.operation.tabId}</code>)
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-slate-500 mb-2">
                      Step-by-Step Instructions:
                    </h4>
                    <div className="space-y-2">
                      {assistantResult.operation.steps.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-white border border-slate-200/80 shadow-xs">
                          <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <p className="text-sm text-slate-800 leading-relaxed pt-0.5">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {assistantResult.operation.tips && (
                    <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                      <span className="text-base">💡</span>
                      <div>
                        <b>Key Best Practice:</b> {assistantResult.operation.tips}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 text-sm text-emerald-950 whitespace-pre-line leading-relaxed font-medium">
                  {assistantResult.answer}
                </div>
              )}
            </Card>
          )}

          {/* Interactive All Software Operations Directory */}
          <Card
            title="Complete FarmFresh Software Operations Directory"
            subtitle="Browse step-by-step instructions for every feature and workflow in the platform"
          >
            {/* Category Filters */}
            <div className="flex flex-wrap gap-1.5 mb-4 pb-3 border-b border-slate-100">
              {['All', 'Farmers', 'Intake & Quality', 'Supply Chain', 'Marketplace', 'Orders & Sales', 'Finance', 'Logistics', 'Market Intelligence', 'Reports & Documents'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setOpCategoryFilter(cat)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    opCategoryFilter === cat
                      ? 'bg-emerald-800 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {filteredOperations.map((op) => {
                const isExpanded = expandedOpId === op.id;
                return (
                  <div
                    key={op.id}
                    className={`border rounded-xl p-4 transition-all ${
                      isExpanded
                        ? 'border-emerald-500 bg-emerald-50/30 shadow-md ring-1 ring-emerald-500/30'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <span className="text-xl p-1 bg-slate-100 rounded-lg">{op.icon}</span>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{op.title}</h4>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                            {op.category}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => setExpandedOpId(isExpanded ? null : op.id)}
                        className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 px-2 py-1 rounded bg-emerald-50"
                      >
                        {isExpanded ? 'Hide Steps' : 'View Steps →'}
                      </button>
                    </div>

                    <p className="text-xs text-slate-600 mt-2">{op.summary}</p>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-slate-200/70 space-y-2">
                        <p className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                          Follow These Steps:
                        </p>
                        <ol className="space-y-1.5 text-xs text-slate-800 pl-1">
                          {op.steps.map((s, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="font-bold text-emerald-700 shrink-0">{idx + 1}.</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ol>
                        {onNavigateTab && (
                          <div className="pt-2">
                            <button
                              onClick={() => onNavigateTab(op.tabId)}
                              className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm"
                            >
                              Go to {op.tabId.toUpperCase()} Screen →
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* TAB: RECONCILIATION */}
      {tab === 'reconcile' && (
        <Card title="Inventory & Stock Movement Reconciliation" subtitle="Verification against recorded stock intake, reservation, and sales">
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <Stat
              label="Inventory Issues"
              value={summary.reconciliation?.inventoryIssues || 0}
              sub="Within 0.1 kg tolerance = MATCH"
              color={summary.reconciliation?.inventoryIssues ? 'red' : 'emerald'}
              icon="📑"
            />
            <Stat
              label="Pending Payout Amount"
              value={money(summary.reconciliation?.pendingPayoutAmount)}
              sub="Obligation due"
              icon="💵"
            />
            <Stat
              label="Total Order Quantity"
              value={kg(summary.reconciliation?.orderQuantityKg)}
              sub="All recorded orders"
              icon="📦"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="p-3 text-left font-semibold text-slate-700">Produce Type</th>
                  <th className="p-3 text-left font-semibold text-slate-700">Grade</th>
                  <th className="p-3 text-left font-semibold text-slate-700">Expected Stock</th>
                  <th className="p-3 text-left font-semibold text-slate-700">Actual Stock</th>
                  <th className="p-3 text-left font-semibold text-slate-700">Variance</th>
                  <th className="p-3 text-left font-semibold text-slate-700">Reconciliation Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(summary.reconciliation?.inventory || []).map((x) => (
                  <tr key={`${x.produceType}-${x.grade}`} className="hover:bg-slate-50/50">
                    <td className="p-3 font-semibold text-slate-900">{x.produceType}</td>
                    <td className="p-3">{x.grade}</td>
                    <td className="p-3">{kg(x.expectedKg)}</td>
                    <td className="p-3">{kg(x.actualKg)}</td>
                    <td className="p-3">{kg(x.differenceKg)}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        x.status === 'MATCH'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-red-50 text-red-800 border border-red-200'
                      }`}>
                        {x.status === 'MATCH' ? '✓ MATCH' : '⚠️ CHECK'}
                      </span>
                    </td>
                  </tr>
                ))}
                {!(summary.reconciliation?.inventory || []).length && (
                  <tr>
                    <td colSpan="6">
                      <Empty text="No inventory reconciliation records to display." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB: DOCUMENTS */}
      {tab === 'documents' && (
        <Card title="Automated FPO Financial & Operational Documents" subtitle="One-click generation of print-ready PDF statements for banks, board, and audits">
          <p className="text-xs text-slate-500 mb-5">
            All documents are formatted to standard print layout. No confidential platform-fee data is exposed in FPO documents.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              ['payout-statement', 'Farmer Payout Statement', 'Consolidated ledger of member disbursements, UTRs, and payment modes.', '💰'],
              ['inventory-report', 'Inventory Stock Report', 'Warehouse balance breakdown categorized by produce type and grade.', '🏬'],
              ['cash-flow-report', 'Cash Flow Position Report', 'Receivables from marketplace orders vs outstanding farmer payables.', '💵'],
              ['reconciliation-report', 'Reconciliation Audit Report', 'Movement verification log of intake, reservations, and fulfilled orders.', '📑'],
            ].map(([type, label, desc, icon]) => (
              <div
                key={type}
                className="border border-slate-200/90 rounded-2xl p-5 bg-white hover:border-slate-300 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="text-2xl mb-2">{icon}</div>
                  <h4 className="font-bold text-slate-900 text-sm">{label}</h4>
                  <p className="text-xs text-slate-500 mt-1">{desc}</p>
                </div>
                <button
                  className={`${btn} mt-4 w-full bg-slate-900 text-white hover:bg-slate-800 hover:text-white border-slate-900`}
                  onClick={() => printDocument(type)}
                >
                  Generate & Print PDF
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
