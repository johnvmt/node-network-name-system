var Utils = require('./Utils');
var ApiBuilder = require('agnostic-router-api-builder');
var apiConfig = require('./apiConfig');

function DnsClient(dnsDb, rpc, config) {
	var self = this;

	self._dnsDb = dnsDb;
	self._rpc = rpc;
	self._dnsServerAddress = config.dnsServer;
	self._apiBasePath = config.apiPath;

	var remoteApiObject = ApiBuilder.toObject(apiConfig, function(functionName, apiPath, request, completeCallback) {
		// Intercept subscribe callback to insert into dnsDb
		if(functionName == 'subscribeToGroup') {
			var callback = function(error, operationDoc) {
				if(error)
					completeCallback(error, null);
				else
					self._dnsDb.groupsOplog.applyOp(operationDoc);
			};
		}
		else
			var callback = completeCallback;

		self._rpc.request(self._dnsServerAddress, self._apiBasePath + apiPath, request.query, typeof apiConfig[functionName].requestOptions == 'object' ? apiConfig[functionName].requestOptions : {}, callback);
	});

	Utils.objectForEach(remoteApiObject, function(functionConfig, functionName) {
		self[functionName] = function() {
			if(typeof self._dnsServerAddress == 'string')
				remoteApiObject[functionName].apply(remoteApiObject, Array.prototype.slice.call(arguments));
			else
				self._dnsDb[functionName].apply(remoteApiObject, Array.prototype.slice.call(arguments));
		};
	});
}

module.exports = function(dnsDb, rpc, config) {
	return new DnsClient(dnsDb, rpc, config);
};