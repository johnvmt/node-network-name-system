var Utils = require('./Utils');

function DnsClient(dnsDb, rpc, dnsServerAddress, config) {
	this._dnsDb = dnsDb;
	this._rpc = rpc;
	this._dnsServerAddress = dnsServerAddress; // TODO what to do if undefined? Make local only?
	this.config = config;
	if(typeof this.config.apiPath != 'string')
		throw new Error('dnsClient_apiPath_undefined');
}


DnsClient.prototype.joinGroup = function(group, callback) {
	var self = this;
	self._rpc.request(self._dnsServerAddress, self._config.apiPath + '/join', {address: self._rpc.address, group: group}, {multipleResponses: false}, callback);
};

DnsClient.prototype.leaveGroup = function(group, callback) {
	var self = this;
	self._rpc.request(self._dnsServerAddress, self._config.apiPath + '/leave', {address: self._rpc.address, group: group}, {multipleResponses: false}, callback);
};

DnsClient.prototype.leaveAllGroups = function(callback) {
	var self = this;
	self._rpc.request(self._dnsServerAddress, self._config.apiPath + '/leaveall', {address: self._rpc.address}, {multipleResponses: false}, callback);
};

DnsClient.prototype.groupAddresses = function(group, callback) {
	var self = this;
	self._rpc.request(self._dnsServerAddress, self._config.apiPath + '/group/find', {group: group}, {multipleResponses: false}, callback);
};

DnsClient.prototype.groupSubscribe = function(group, callback) {
	var self = this;
	self._rpc.request(self._dnsServerAddress, self._config.apiPath + '/group/subscribe', {group: group}, {multipleResponses: true}, function(error, operationDoc) {
		if(error)
			callback(error, null);
		else if(operationDoc.operation == 'subscribe')
			callback(null, operationDoc.subscriptionId);
		else
			self._dnsDb.groupsOplog.applyOp(operationDoc);
	});
};

module.exports = function(dnsDb, rpc, dnsServerAddress, config) {
	return new DnsClient(dnsDb, rpc, dnsServerAddress, config);
};