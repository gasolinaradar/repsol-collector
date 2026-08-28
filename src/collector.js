const { fetchStations } = require('./fetch');

function createRepsolCollector(options = {}) {
  return {
    name: 'repsol',
    country: 'ES',
    async fetch(context = {}) {
      const reportProgress =
        typeof context?.reportProgress === 'function' ? context.reportProgress : () => {};
      return fetchStations(options, { reportProgress });
    },
  };
}

module.exports = {
  createRepsolCollector,
};
