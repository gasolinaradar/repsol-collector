const { fetchStations } = require('./fetch');

function createRepsolCollector(options = {}) {
  return {
    name: 'repsol',
    country: 'ES',
    async fetch(context = {}) {
      const reportProgress =
        typeof context?.reportProgress === 'function' ? context.reportProgress : () => {};
      const reportBatch =
        typeof context?.onBatch === 'function' ? context.onBatch : () => {};
      return fetchStations(options, { reportProgress, reportBatch });
    },
  };
}

module.exports = {
  createRepsolCollector,
};
