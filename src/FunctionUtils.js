var FunctionUtils = {};

FunctionUtils.objectPublicFunctions = function(object) {
	function objFunctions(object) {
		var functionNames = [];
		for(var attribute in object) {
			if(typeof object[attribute] === 'function')
				functionNames.push(attribute);
		}
		return functionNames;
	}

	return objFunctions(object).filter(function(attribute) {
		return (attribute[0] !== '_' && attribute !== 'globalFunctions');
	});
};

FunctionUtils.objectReplicateFunctions = function(sourceObject, targetObject, excludeFunctions) {
	if(!Array.isArray(excludeFunctions))
		excludeFunctions = [];

	var functions = FunctionUtils.objectPublicFunctions(sourceObject); // get collection's public functions
	functions.forEach(function(functionName) {
		if(typeof targetObject[functionName] == 'undefined' && excludeFunctions.indexOf(functionName) < 0) { // safety check, don't override own functions
			// set own public function to match collection's function
			targetObject[functionName] = function () {
				sourceObject[functionName].apply(sourceObject, Array.prototype.slice.call(arguments));
			}
		}
	});
};

module.exports = FunctionUtils;