var assert = require('assert');
var Rpc = require('..');
var VirtualLink = require('node-network/test/links/VirtualLink');

describe('RouteTable Functions', function() {
	describe('request', function() {

		var node1, node2;

		// Set up
		before(function(done){
			node1 = Rpc({
				dnsDb: {
					public: true,
					apiPath: '/api/dns'
				},
				dnsClient: {},
				network: {
					address: 'node1'
				}
			});

			node1.dnsClient._id = 'node1';
			node1.dnsClient._dnsDb._id = 'node1';

			node2 = Rpc({
				dnsClient: {
					dnsServer: 'node1'
				}
			});

			node2.dnsClient._id = 'node2';
			node2.dnsClient._dnsDb._id = 'node2';

			var link_1_2 = VirtualLink();

			node1.addConnection(link_1_2.connection1);
			node2.addConnection(link_1_2.connection2);

			link_1_2.connection1.connect();
			link_1_2.connection2.connect();

			node2.on('connect', function() {
				done();
			});

		});

		it('Insert route into route table', function(done) {

			node1.dnsClient.addToGroup(node1.address, 'mygroup', function(error, result) {

			});
			node1.router.use(function(request, respond, next) {
				respond(null, 'ok');
			});

			node2.request('mygroup', '/test', {}, {groupSubscribe: false}, function(error, response) {
				//console.log(error, response);
				if(error)
					throw new Error(error);
				else if(response == 'ok')
					done();
				else
					throw new Error('wrong response');
			});
		});
	});

});