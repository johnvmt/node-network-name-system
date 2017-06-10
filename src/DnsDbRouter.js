module.exports = function(dnsDb) {
	var Oms = require('oms');
	var OmsUtils = Oms.OmsUtils;
	var router = require('agnostic-router')();

	router.use('/join', function(request, respond, next) {
		dnsDb.addToGroup(request.query.address, request.query.group, respond);
	});

	router.use('/leave', function(request, respond, next) {
		dnsDb.removeFromGroup(request.query.address, request.query.group, respond);
	});

	router.use('/leaveall', function(request, respond, next) {
		dnsDb.removeFromAllGroups(request.query.address, respond);
	});

	router.use('/group/find', function(request, respond, next) {
		dnsDb.groupAddresses(request.query.group, respond);
	});

	router.use('/group/subscribe', function(request, respond, next) {
		if(typeof request.query.group != 'string')
			var collectionQuery = {_id: request.query.group};
		else if(typeof request.query.query == 'object' && request.query.query != null)
			var collectionQuery = request.query.query;
		else
			var collectionQuery = {};

		var oplogQuery = (typeof request.query.oplogQuery == 'object') ? request.query.oplogQuery : {};

		var subscriptionId = dnsDb.groupsOplogSubscriptions.findSubscribe(collectionQuery, oplogQuery, function(error, operationDoc) {
			if(error)
				respond(error, null);
			else
				respond(null, OmsUtils.operationDocMin(operationDoc));
		});

		respond(null, {operation: 'subscribe', subscriptionId: subscriptionId});
	});

	router.use('/group/unsubscribe', function(request, respond, next) {
		var subscriptionId = request.query.subscription;
		if(typeof subscriptionId != 'string')
			respond('subscription_undefined', null);
		else {
			try {
				dnsDb.groupsOplogSubscriptions.unsubscribe(subscriptionId);
				respond(null, true);
			}
			catch(error) {
				respond(error.message, null);
			}
		}
	});

	return router;
};