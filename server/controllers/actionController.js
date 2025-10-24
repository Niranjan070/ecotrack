const Action = require('../models/Action');
const User = require('../models/User');

const CATEGORY_POINTS = {
  Recycled: 10,
  PublicTransport: 15,
  AvoidedPlastic: 20,
  PlantedTree: 30
};

const addAction = async (req, res) => {
  try {
    const { category, note, date } = req.body;
    if (!CATEGORY_POINTS[category]) return res.status(400).json({ message: 'Invalid category' });

    const points = CATEGORY_POINTS[category];
    const action = new Action({ user: req.user.id, category, note, date: date || Date.now(), points });
    await action.save();

    await User.findByIdAndUpdate(req.user.id, { $inc: { totalScore: points } });

    res.json({ action });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const getActions = async (req, res) => {
  try {
    const actions = await Action.find({ user: req.user.id }).sort({ date: -1 }).limit(100);
    const user = await User.findById(req.user.id);
    res.json({ actions, totalScore: user.totalScore });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const stats = async (req, res) => {
  try {
    const actions = await Action.find({ user: req.user.id });

    // actions per category
    const counts = actions.reduce((acc, a) => { acc[a.category] = (acc[a.category]||0)+1; return acc; }, {});

    // weekly growth - group by week (start of week)
    const weekly = {};
    actions.forEach(a => {
      const wk = new Date(a.date);
      wk.setHours(0,0,0,0);
      const day = wk.getDate();
      // simple week key: yyyy-mm-dd of week start (mon)
      const dayOfWeek = wk.getDay();
      const diff = (dayOfWeek+6)%7; // make monday=0
      wk.setDate(wk.getDate()-diff);
      const key = wk.toISOString().slice(0,10);
      weekly[key] = (weekly[key]||0) + a.points;
    });

    // transform weekly to sorted array
    const weeklyArr = Object.keys(weekly).sort().map(k => ({ week: k, points: weekly[k] }));

    res.json({ counts, weekly: weeklyArr });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { addAction, getActions, stats };
