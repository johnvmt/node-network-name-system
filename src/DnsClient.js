var Utils = require('./Utils');
var ApiBuilder = require('agnostic-router-api-builder');
var apiConfig = require('./apiConfig');

function DnsClient(dnsDb, rpc, config) {
	var self = this;

	self._dnsDb = dnsDb;
	self._rpc = rpc;
	self._dnsServerAddress = config.dnsServer;
	self._apiBasePath = config.apiPath;

	self._remoteApiObject = ApiBuilder.toObject(apiConfig, function(functionName, apiPath, request, completeCallback) {
		self._rpc.request(self._dnsServerAddress, self._apiBasePath + apiPath, request.query, typeof apiConfig[functionName].requestOptions == 'object' ? apiConfig[functionName].requestOptions : {}, completeCallback);
	});

	Utils.objectForEach(self._remoteApiObject, function(functionConfig, functionName) {
		if(typeof self[functionName] != 'function') {
			self[functionName] = function() {
				if(typeof self._dnsServerAddress == 'string')
					self._remoteApiObject[functionName].apply(self._remoteApiObject, Array.prototype.slice.call(arguments));
				else
					self._dnsDb[functionName].apply(self._dnsDb, Array.prototype.slice.call(arguments));
			};
		}
	});
}

DnsClient.prototype.subscribeToGroup = function() {
	var self = this;
	if(typeof self._dnsServerAddress == 'string') { // Only intercept if remote server
		var argsArrayPass = Array.prototype.slice.call(arguments);

		var completeCallback = argsArrayPass.pop();
		var interceptCallback = function(error, operationDoc) {
			if(error == null)
				self._dnsDb.groupsOplog.applyOp(operationDoc);
			completeCallback(error, operationDoc);
		};

		self._remoteApiObject.subscribeToGroup.apply(self._remoteApiObject, argsArrayPass.concat([interceptCallback]));
	}
	else {
		self._dnsDb.subscribeToGroup.apply(self._dnsDb, Array.prototype.slice.call(arguments));
	}
};

// Override groupAddresses to add subscribe option
DnsClient.prototype.groupAddresses = function() {
	var self = this;

	var parsedArgs = Utils.parseArgs(
		arguments,
		[
			{name: 'groupName', required: true, level: 0, type: 'string'},
			{name: 'options', level: 1, type: 'object', default: {}},
			{name: 'callback', required: true, level: 0,  type: 'function'}
		]
	);

	var defaultOptions = {
		groupLookup: true,
		groupSubscribe: false
	};

	parsedArgs.options = Utils.objectMerge(defaultOptions, parsedArgs.options);

	self._dnsDb.groupAddresses(parsedArgs.groupName, function(error, result) {
		if(!error || !parsedArgs.options.groupLookup || typeof self._dnsServerAddress != 'string') // Result returned or don't lookup
			parsedArgs.callback(error, result);
		else if(parsedArgs.options.groupSubscribe) { // Subscribe to remote group
			self.subscribeToGroup(parsedArgs.groupName, function(error, opLogDoc) {
				if(error)
					parsedArgs.callback(error, null);
				else if(Utils.objectGet(opLogDoc, ['operation', 'operation']) == 'subscribe' && Utils.objectGet(opLogDoc, ['operation', 'status']) == 'find-complete') // Group is up to date in local db
					self.groupAddresses(parsedArgs.groupName, {groupLookup: false, groupSubscribe: false}, parsedArgs.callback); // Get the group from the local db
			});
		}
		else // Call groupAddresses remote, do not subscribe
			self._remoteApiObject.groupAddresses(parsedArgs.groupName, parsedArgs.callback);
	});
};

module.exports = function(dnsDb, rpc, config) {
	return new DnsClient(dnsDb, rpc, config);
};