'use strict';

const ComplianceTask = require('../models/ComplianceTask');

const DAY_MS = 86400000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const OPEN_STATUSES = ['PENDING', 'IN_PROGRESS'];
const CATEGORIES = ['STATUTORY', 'FINANCE', 'GOVERNANCE', 'KYC', 'OPERATIONS'];
const STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'NOT_APPLICABLE'];

// Standard checklist for a Producer Company / FPO.
// IMPORTANT: these deliberately carry NO due dates. Statutory deadlines change and depend on the
// FPO's registration type and financial year, so the FPO enters each date after confirming it
// with its CA / Company Secretary.
const TEMPLATES = [
  { title: 'Statutory audit by a Chartered Accountant', category: 'STATUTORY' },
  { title: 'Hold Annual General Meeting (AGM)', category: 'GOVERNANCE' },
  { title: 'Send AGM notice to all members', category: 'GOVERNANCE' },
  { title: 'File audited financial statements with the Registrar (MCA)', category: 'STATUTORY' },
  { title: 'File annual return with the Registrar (MCA)', category: 'STATUTORY' },
  { title: 'Director KYC (DIN) for all directors', category: 'KYC' },
  { title: 'Hold Board meetings and record minutes', category: 'GOVERNANCE' },
  { title: 'Update statutory registers (members, directors, share capital)', category: 'STATUTORY' },
  { title: 'File GST returns (if GST-registered)', category: 'FINANCE' },
  { title: 'File income tax return', category: 'FINANCE' },
  { title: 'Deposit TDS and file TDS returns (if applicable)', category: 'FINANCE' },
  { title: 'Reconcile bank statement with FarmFresh records', category: 'FINANCE' },
  { title: 'Renew FSSAI licence (if applicable)', category: 'KYC' },
  { title: 'Keep PAN, GSTIN and registration certificates up to date', category: 'KYC' },
  { title: 'Update member / shareholder register after new enrolments', category: 'OPERATIONS' },
  { title: 'Submit progress report to the CBBO', category: 'OPERATIONS' },
];

const TEMPLATE_NOTE = 'Confirm the due date and applicability with your CA / Company Secretary before relying on this.';

const istKey = (d) => {
  const t = new Date(d).getTime();
  if (!Number.isFinite(t)) return '';
  return new Date(t + IST_OFFSET_MS).toISOString().slice(0, 10);
};

// A due date is a calendar date (stored at UTC midnight). "Today" is the Indian calendar date.
function daysUntil(dueDate, now = new Date()) {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;
  const dueKey = due.toISOString().slice(0, 10);
  const todayKey = istKey(now);
  if (!todayKey) return null;
  return Math.round((new Date(`${dueKey}T00:00:00Z`) - new Date(`${todayKey}T00:00:00Z`)) / DAY_MS);
}

function decorateTask(task, now = new Date()) {
  const plain = typeof task.toObject === 'function' ? task.toObject() : { ...task };
  const open = OPEN_STATUSES.includes(plain.status);
  const days = daysUntil(plain.dueDate, now);
  return {
    ...plain,
    daysToDue: open ? days : null,
    isOverdue: open && days !== null && days < 0,
    isDueSoon: open && days !== null && days >= 0 && days <= 30,
  };
}

function summarize(tasks, now = new Date()) {
  const decorated = tasks.map((t) => decorateTask(t, now));
  const count = (fn) => decorated.filter(fn).length;
  return {
    decorated,
    summary: {
      total: decorated.length,
      pending: count((t) => t.status === 'PENDING'),
      inProgress: count((t) => t.status === 'IN_PROGRESS'),
      completed: count((t) => t.status === 'COMPLETED'),
      notApplicable: count((t) => t.status === 'NOT_APPLICABLE'),
      overdue: count((t) => t.isOverdue),
      dueSoon: count((t) => t.isDueSoon),
      noDate: count((t) => OPEN_STATUSES.includes(t.status) && !t.dueDate),
    },
  };
}

// Compact snapshot used inside the bank-ready pack.
async function complianceSnapshot(fpoId, now = new Date()) {
  const tasks = await ComplianceTask.find({ fpo: fpoId }).sort({ dueDate: 1 }).lean();
  const { decorated, summary } = summarize(tasks, now);
  const open = decorated
    .filter((t) => OPEN_STATUSES.includes(t.status))
    .sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return ad - bd;
    })
    .slice(0, 15)
    .map((t) => ({ title: t.title, category: t.category, status: t.status, dueDate: t.dueDate || null, isOverdue: t.isOverdue }));
  return { summary, open };
}

module.exports = {
  TEMPLATES,
  TEMPLATE_NOTE,
  CATEGORIES,
  STATUSES,
  OPEN_STATUSES,
  daysUntil,
  decorateTask,
  summarize,
  complianceSnapshot,
};
