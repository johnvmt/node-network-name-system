var EventEmitter = require('wolfy87-eventemitter');
var NodeNetworkRpc = require('node-network-rpc');
var DnsClient = require('./DnsClient');
var DnsDb = require('./DnsDb');
var DnsDbRouter = require('./DnsDbRouter');
var Utils = require('./Utils');

function DnsRpc(config) {
	var self = this;

	var defaultConfig = {
		dnsDb: {
			apiPath: '/api/dns', // Default path on router
			public: false // Default is hidden
		},
		dnsClient: {
			apiPath: '/api/dns' // Default path on router
		},
		network: {}
	};

	self._config = Utils.objectMerge(defaultConfig, config);
	self._config.dnsDb = Utils.objectMerge(defaultConfig.dnsDb, self._config.dnsDb);
	self._config.dnsClient = Utils.objectMerge(defaultConfig.dnsClient, self._config.dnsClient);

	// Set up RPC
	self.connected = false;
	self.rpc = NodeNetworkRpc(self._config.network);
	self.network = self.rpc.network;
	self.router = self.rpc.router;

	self.network.on('address', function(address) {
		self.address = address;

		self.emit('address', address);

		if(typeof address == 'undefined') { // Disconnected
			if(typeof self._prevAddress != 'undefined')
				self.dnsClient.removeFromAllGroups(self._prevAddress);
			self.emit('disconnect');
		}
		else { // Connected
			if(Array.isArray(self._config.groups)) {
				self._config.groups.forEach(function(groupName) {
					self.dnsClient.addToGroup(address, groupName)
				});
			}
			self.emit('connect');
		}

		self._prevAddress = address;
	});

	// Set up DNS
	self.dnsDb = DnsDb(self._config.dnsDb);
	self.dnsClient = DnsClient(self.dnsDb, self.rpc, self._config.dnsClient);

	// Add dnsDb to Router (make dnsDb public on the network)
	if(typeof self._config.dnsDb.public == 'boolean' && self._config.dnsDb.public) {
		self.router.use(self._config.dnsDb.apiPath, DnsDbRouter(self.dnsDb));
	}
}

DnsRpc.prototype.__proto__ = EventEmitter.prototype;

DnsRpc.prototype.request = function() {
	var self = this;

	// TODO make destGroup optional
	var parsedArgs = Utils.parseArgs(
		arguments,
		[
			{name: 'destGroup', level: 1, type: 'string', default: self._config.defaultGroup},
			{name: 'path', level: 0, validate: function(arg, allArgs) { return typeof arg == 'string' && arg[0] == '/'; }},
			{name: 'query', level: 1, type: 'object', default: {}},
			{name: 'options', level: 2,  type: 'object', default: {}},
			{name: 'callback', level: 1,  type: 'function'}
		]
	);

	if(typeof parsedArgs.destGroup != 'string')
		callbackSafe('destGroup_undefined', null);
	else {
		self.dnsClient.groupAddresses(parsedArgs.destGroup, parsedArgs.options, function(error, addresses) {
			if(error) {
				if(error == 'group_undefined') {}
				else
					callbackSafe(error, null);
			}
			else
				self.rpc.request(addresses, parsedArgs.path, parsedArgs.query, parsedArgs.options, callbackSafe);
		});
	}

	function callbackSafe(error, result) {
		if(typeof parsedArgs.callback == 'function')
			parsedArgs.callback(error, result);
	}
};

DnsRpc.prototype.addConnection = function() {
	this.rpc.addConnection.apply(this.rpc, Array.prototype.slice.call(arguments));
};

module.exports = function(config) {
	return new DnsRpc(config)
};