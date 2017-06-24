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
	self.rpc = NodeNetworkRpc(self._config.network);
	self.network = self.rpc.network;
	self.router = self.rpc.router;
	['connect', 'disconnect'].forEach(function(eventType) {
		self.rpc.on(eventType, function() {
			self.emit(eventType, Array.prototype.slice.call(arguments));
		});
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
			{name: 'destGroup', level: 1, type: 'string', default: self.config.defaultGroup},
			{name: 'path', level: 0, validate: function(arg, allArgs) { return typeof arg == 'string' && arg[0] == '/'; }},
			{name: 'query', level: 1, type: 'object', default: {}},
			{name: 'options', level: 2,  type: 'object', default: {}},
			{name: 'callback', level: 1,  type: 'function'}
		]
	);

	var defaultOptions = {
		groupLookup: true,
		groupSubscribe: false
	};

	parsedArgs.options = Utils.objectMerge(defaultOptions, parsedArgs.options);

	if(typeof parsedArgs.destGroup != 'string')
		callbackSafe('destGroup_undefined', null);
	else {
		self._dnsDb.groups.findOne(parsedArgs.destGroup, function(error, groupDoc) {
			if(error)
				callbackSafe(error, null);
			else if(groupDoc != null) { // Group is saved locally
				if(Array.isArray(groupDoc.addresses) && groupDoc.addresses.length > 0) // group has members
					self._rpc.request(groupDoc.addresses, parsedArgs.path, parsedArgs.query, parsedArgs.options, parsedArgs.callback);
			}
			else if(parsedArgs.options.groupLookup) { // Try retreiving group remotely
				if(parsedArgs.options.groupSubscribe) {
					// TODO check if subscription in progress
					self.groupSubscribe(parsedArgs.destGroup, function(error, subscriptionId) {
						self._dnsDb.groups.findOne(parsedArgs.destGroup, function(error, groupDoc) {
							if(error)
								callbackSafe(error, null);
							else if(groupDoc == null || (Array.isArray(groupDoc.addresses) && groupDoc.addresses.length == 0))
								callbackSafe('empty_group', null)
							else if(Array.isArray(groupDoc.addresses) && groupDoc.addresses.length > 0) { // group has members
								self._rpc.request(groupDoc.addresses, parsedArgs.path, parsedArgs.query, parsedArgs.options, parsedArgs.callback);
							}
						});
					});
				}
				else {
					self.groupAddresses(parsedArgs.destGroup, function(error, addresses) {
						if(error)
							callbackSafe(error, null);
						else
							self._rpc.request(addresses, parsedArgs.path, parsedArgs.query, parsedArgs.options, parsedArgs.callback);
					});
				}
			}
			else
				callbackSafe('group_undefined', null);
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