const express = require('express');
const mongoose = require('mongoose');
const Fpo = require('../models/Fpo');
const ComplianceTask = require('../models/ComplianceTask');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const {
  TEMPLATES,
  TEMPLATE_NOTE,
  CATEGORIES,
  STATUSES,
  decorateTask,
  summarize,
} = require('../services/complianceService');

const router = express.Router();

const getFpo = (req) => {
  const userId = req.user._id || req.user.id;
  return Fpo.findOne({ $or: [{ adminUser: userId }, { staff: userId }] }).select('_id');
};

// Due dates are calendar dates, stored at UTC midnight. Returns undefined when absent, null to clear,
// a Date when valid, and false when the value is not a real date.
function parseDueDate(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const str = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(`${str}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== str) return false;
  return d;
}

const ORDER = { PENDING: 0, IN_PROGRESS: 1, COMPLETED: 2, NOT_APPLICABLE: 3 };

// List tasks + summary (admin and staff can read).
router.get('/', protect, authorizeRoles('fpo_admin', 'fpo_staff'), async (req, res) => {
  try {
    const fpo = await getFpo(req);
    if (!fpo) return res.json({ tasks: [], summary: summarize([]).summary });
    const tasks = await ComplianceTask.find({ fpo: fpo._id }).lean();
    const { decorated, summary } = summarize(tasks);
    decorated.sort((a, b) => {
      if (ORDER[a.status] !== ORDER[b.status]) return ORDER[a.status] - ORDER[b.status];
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return ad - bd;
    });
    res.json({ tasks: decorated, summary });
  } catch (e) {
    console.error('Compliance list error:', e);
    res.status(500).json({ message: 'Unable to load compliance tasks.' });
  }
});

// Add the standard checklist. Safe to run repeatedly: titles that already exist are skipped.
router.post('/seed-defaults', protect, authorizeRoles('fpo_admin'), async (req, res) => {
  try {
    const fpo = await getFpo(req);
    if (!fpo) return res.status(404).json({ message: 'FPO profile not found.' });
    const existing = await ComplianceTask.find({ fpo: fpo._id }).select('title').lean();
    const have = new Set(existing.map((t) => String(t.title || '').trim().toLowerCase()));
    const fresh = TEMPLATES.filter((t) => !have.has(t.title.toLowerCase()));
    if (fresh.length) {
      await ComplianceTask.insertMany(
        fresh.map((t) => ({ fpo: fpo._id, title: t.title, category: t.category, status: 'PENDING', notes: TEMPLATE_NOTE }))
      );
    }
    res.status(201).json({ added: fresh.length, skipped: TEMPLATES.length - fresh.length });
  } catch (e) {
    console.error('Compliance seed error:', e);
    res.status(500).json({ message: 'Unable to add the standard checklist.' });
  }
});

// Create one task.
router.post('/', protect, authorizeRoles('fpo_admin'), async (req, res) => {
  try {
    const fpo = await getFpo(req);
    if (!fpo) return res.status(404).json({ message: 'FPO profile not found.' });
    const title = String(req.body?.title || '').trim();
    if (!title) return res.status(400).json({ message: 'Task title is required.' });
    if (title.length > 180) return res.status(400).json({ message: 'Task title must be 180 characters or fewer.' });
    const category = CATEGORIES.includes(req.body?.category) ? req.body.category : 'OPERATIONS';
    const dueDate = parseDueDate(req.body?.dueDate);
    if (dueDate === false) return res.status(400).json({ message: 'Due date must be a valid date (YYYY-MM-DD).' });
    const notes = String(req.body?.notes || '').trim();
    if (notes.length > 1000) return res.status(400).json({ message: 'Notes must be 1000 characters or fewer.' });

    const task = await ComplianceTask.create({
      fpo: fpo._id,
      title,
      category,
      notes,
      status: 'PENDING',
      ...(dueDate ? { dueDate } : {}),
    });
    res.status(201).json(decorateTask(task));
  } catch (e) {
    console.error('Compliance create error:', e);
    res.status(500).json({ message: 'Unable to create the task.' });
  }
});

// Update a task (title, category, due date, notes, status).
router.patch('/:id', protect, authorizeRoles('fpo_admin'), async (req, res) => {
  try {
    const fpo = await getFpo(req);
    if (!fpo) return res.status(404).json({ message: 'FPO profile not found.' });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid task id.' });
    const task = await ComplianceTask.findOne({ _id: req.params.id, fpo: fpo._id });
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    const body = req.body || {};
    if (body.title !== undefined) {
      const title = String(body.title || '').trim();
      if (!title) return res.status(400).json({ message: 'Task title cannot be empty.' });
      if (title.length > 180) return res.status(400).json({ message: 'Task title must be 180 characters or fewer.' });
      task.title = title;
    }
    if (body.category !== undefined) {
      if (!CATEGORIES.includes(body.category)) return res.status(400).json({ message: 'Invalid category.' });
      task.category = body.category;
    }
    if (body.notes !== undefined) {
      const notes = String(body.notes || '').trim();
      if (notes.length > 1000) return res.status(400).json({ message: 'Notes must be 1000 characters or fewer.' });
      task.notes = notes;
    }
    const dueDate = parseDueDate(body.dueDate);
    if (dueDate === false) return res.status(400).json({ message: 'Due date must be a valid date (YYYY-MM-DD).' });
    if (dueDate === null) task.dueDate = undefined;
    else if (dueDate) task.dueDate = dueDate;

    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) return res.status(400).json({ message: 'Invalid status.' });
      task.status = body.status;
      task.completedAt = body.status === 'COMPLETED' ? task.completedAt || new Date() : undefined;
    }

    await task.save();
    res.json(decorateTask(task));
  } catch (e) {
    console.error('Compliance update error:', e);
    res.status(500).json({ message: 'Unable to update the task.' });
  }
});

// Delete a task.
router.delete('/:id', protect, authorizeRoles('fpo_admin'), async (req, res) => {
  try {
    const fpo = await getFpo(req);
    if (!fpo) return res.status(404).json({ message: 'FPO profile not found.' });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid task id.' });
    const removed = await ComplianceTask.findOneAndDelete({ _id: req.params.id, fpo: fpo._id });
    if (!removed) return res.status(404).json({ message: 'Task not found.' });
    res.json({ message: 'Task deleted.' });
  } catch (e) {
    console.error('Compliance delete error:', e);
    res.status(500).json({ message: 'Unable to delete the task.' });
  }
});

module.exports = router;
