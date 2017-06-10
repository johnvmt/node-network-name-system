var Mongolocal = require('mongolocal');
var Oms = require('oms');
var Utils = require('./Utils');

function DnsDb(options) {
	var defaultOptions = {
		removeEmptyGroups: true,
		removeEmptyAddresses: true,
		groupsOplogMax: 1000,
		addressesOplogMax: 1000
	};

	this._options = Utils.objectMerge(defaultOptions, options);

	this.groups = Mongolocal({});
	this.groupsOplog = Oms.OmsOplog(this.groups, {max: this._options.groupsOplogMax}, {});
	this.groupsOplogSubscriptions = Oms.OmsOplogSubscriptions(this.groupsOplog);

	this.addresses = Mongolocal({});
	this.addressesOplog = Oms.OmsOplog(this.addresses, {max: this._options.addressesOplogMax}, {});
	this.addressesOplogSubscriptions = Oms.OmsOplogSubscriptions(this.addressesOplog);
}

DnsDb.prototype.addToGroup = function(address, groupName, callback) {
	var self = this;
	if(typeof address != 'string')
		callbackSafe('address_format_incorrect');
	else if(typeof groupName != 'string')
		callbackSafe('group_format_incorrect');
	else {
		updateGroup(function(error) {
			if(error)
				callbackSafe(error, null);
			else {
				updateAddress(function (error) {
					if (error)
						callbackSafe(error, null);
					else
						callbackSafe(null, true);
				});
			}
		});
	}

	function updateAddress(callback) {
		var addressQuery = {_id: address};
		var addressDoc = Utils.objectMerge(addressQuery, {$addToSet: {groups: groupName}});
		self.addresses.update(addressQuery, addressDoc, {upsert: true}, callback);
	}

	function updateGroup(callback) {
		var groupQuery = {_id: groupName};
		var groupDoc = Utils.objectMerge(groupQuery, {$addToSet: {addresses: address}});
		self.groups.update(groupQuery, groupDoc, {upsert: true}, callback);
	}

	function callbackSafe(error, response) {
		if(typeof callback == 'function')
			callback(error, response);
	}
};

DnsDb.prototype.removeFromGroup = function(address, groupName, callback) {
	var self = this;
	if(typeof address != 'string')
		callbackSafe('address_format_incorrect');
	else if(typeof groupName != 'string')
		callbackSafe('group_format_incorrect');
	else {
		updateGroup(function(error) {
			if(error)
				callbackSafe(error, null);
			else {
				updateAddress(function (error) {
					if (error)
						callbackSafe(error, null);
					else
						callbackSafe(null, true);
				});
			}
		});
	}

	function updateGroup(callback) {
		var groupQuery = {_id: groupName};
		var groupUpdateOperation = Utils.objectMerge(groupQuery, {$pull: {addresses: address}});

		// Remove the address from the group
		self.groups.update(groupQuery, groupUpdateOperation, function(error, writeResult) {
			if(error)
				callback(error);
			else {
				// Remove group if no addresses remain
				if(self._options.removeEmptyGroups) {
					var groupQueryEmpty = Utils.objectMerge(groupQuery, {addresses: {$size: 0}});
					self.groups.remove(groupQueryEmpty);
				}
				callback(null);
			}
		});
	}

	function updateAddress(callback) {
		var addressQuery = {_id: address};
		var addressUpdateOperation = Utils.objectMerge(addressQuery, {$pull: {groups: groupName}});

		// Remove the address from the group
		self.addresses.update(addressQuery, addressUpdateOperation, function(error, writeResult) {
			if(error)
				callback(error);
			else {
				// Remove address if no groups remain

				if(self._options.removeEmptyAddresses) {
					var groupQueryEmpty = Utils.objectMerge(addressQuery, {groups: {$size: 0}});
					self.addresses.remove(groupQueryEmpty);
				}
				callback(null);
			}
		});
	}

	function callbackSafe(error, response) {
		if(typeof callback == 'function')
			callback(error, response);
	}
};

DnsDb.prototype.removeFromAllGroups = function(address, callback) {
	var self = this;
	if(typeof address != 'string')
		callbackSafe('address_format_incorrect');
	else {
		self.addresses.findOne({_id: address}, function(error, addressDoc) {
			if(error)
				callbackSafe(error, null);
			else if(addressDoc == null)
				callbackSafe(null, true);
			else {
				if(Array.isArray(addressDoc.groups)) {
					addressDoc.groups.forEach(function(groupName) {
						self.removeFromGroup(address, groupName);
					});
				}
				callbackSafe(null, true);
			}
		});
	}

	function callbackSafe(error, response) {
		if(typeof callback == 'function')
			callback(error, response);
	}
};

module.exports = function(options) {
	return new DnsDb(options);
};