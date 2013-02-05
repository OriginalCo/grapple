module.exports = process.env.GRAPPLE_COV
  ? require('./lib-cov/grapple')
  : require('./lib/grapple');
