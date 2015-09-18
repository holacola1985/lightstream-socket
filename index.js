var observableSocket = require('./lib/ObservableSocket');

module.exports = {
  Socket: require('./lib/Socket'),
  MapboxSocket: require('./lib/MapboxSocket'),
  ObservableSocket: observableSocket(require('./lib/Socket')),
  MapboxObservableSocket: observableSocket(require('./lib/MapboxSocket'))
};