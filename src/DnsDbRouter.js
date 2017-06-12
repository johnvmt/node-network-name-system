module.exports = function(dnsDb) {
	var apiConfig = require('./apiConfig');
	var ApiBuilder = require('agnostic-router-api-builder');
	var Oms = require('oms');
	var OmsUtils = Oms.OmsUtils;
	var router = require('agnostic-router')();

	// intercept groupSubscribe to minify results
	router.use('/group/subscribe', function(request, respond, next) {
		dnsDb.subscribeToGroup(typeof request.query.group == 'string' ? request.query.group : request.query.query, request.query.oplogQuery, function(error, operationDoc) {
			if(error)
				respond(error, null);
			else
				respond(null, OmsUtils.operationDocMin(operationDoc));
		});
	});

	ApiBuilder.toRouter(apiConfig, router); // Add functions specified in apiConfig.json

	return router;
};