var rootApp = angular.module('rootApp', ^^=JSON.stringify(local.angularDeps) || '[]'$$);
rootApp.directive('autocomplete', function($parse) {
  return {
    require: 'ngModel',
		link: function(scope, element, attrs) {
    var setSelection = $parse(attrs.ngModel).assign;
    scope.$watch(attrs.autocomplete, function(value) {
      element.autocomplete({				
        source: value
      });
    });
		}
	};
});
rootApp.directive('contenteditable', function() {
  return {
    require: 'ngModel',
    link: function(scope, element, attrs, ctrl) {
      // view -> model
      element.bind('blur', function() {
        scope.$apply(function() {
          ctrl.$setViewValue(element.html());
        });
      });
      // model -> view
      ctrl.$render = function() {
        element.html(ctrl.$viewValue);
      };
      // load init value from DOM
			ctrl.$render();
    }
  };
});
rootApp.directive('video', function() {
  return {
    restrict: 'E',
    link: function(scope, element) {
      scope.$on('$destroy', function() {
        element.prop('src', '');
      });
    }
  };
})
rootApp.directive('fileModel', ['$parse', function ($parse) {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      var model = $parse(attrs.fileModel);
      var modelSetter = model.assign;

      element.bind('change', function(){
        scope.$apply(function(){
          modelSetter(scope, element[0].files[0]);
        });
      });
    }
  };
}]);

rootApp.factory('auth', function($http, $cookieStore, $rootScope){
	var methods = {};
	var idstr = "^^=name$$";
	var persist = ["token", "userid"];
	persist.forEach(function(p){
		methods["get" + p] = function(){
			var str;
			try{
				str = $cookieStore.get(p+idstr);
			}catch(e){
				return null;
			}
			return str;
		};
		methods["set" + p] = function(str){
			$cookieStore.put(p+idstr, str.toString());
		};
	});
	methods.get = function(){
		var rtn = {};
		persist.forEach(function(p){
			rtn[p] = methods["get" + p]();
		});
		return rtn;
	}
	methods.set = function(json){
		persist.forEach(function(p){
      methods["set" + p](json[p]);
    });
	}
	methods.signout = function(){
		methods.set({});
		location = signinUrl;
	}
  return methods;
});
rootApp.factory('req', function($http){
	var methods = {};
	var ajax;
	methods.ajax = ajax = function (config, fn){
		$http(config).then(function(result){
			fn(null, result.data, {
				statusCode: result.status,
				headers: result.headers()
			});
		}, function(result){
			fn(config.method +" " + config.url + " FAILED", result.data, {
				statusCode: result.status,
        headers: result.headers()
			});
		})
	};
	["get", "post", "put", "delete"].forEach(function(method){
		methods[method] = function(url, data, fn){
			if(!fn) fn = data;
			var config = {url: url, method: method.toUpperCase(), headers: {
				Cookie: ""
			}};
			if(data) config.data = data;
			ajax(config, fn);
		};
		methods[method + "Ex"] = function(url, headers, data, fn){
			if(!fn) fn = data;
			var config = {url: url, method: method.toUpperCase(), headers: headers};
			if(data) config.data = data;
			ajax(config, fn);			
		};
		methods[method+"Bearer"] = function(url, token, data, fn){
			methods[method + "Ex"](url, {
				Authorization: "Bearer "+token
			}, data, fn);
		};
		methods[method+"Form"] = function(url, data, fn){
			methods[method + "Ex"](url, {
				"Content-type": "application/x-www-form-urlencoded"
			}, data, fn);
		};
		methods[method+"Json"] = function(url, data, fn){
			methods[method + "Ex"](url, {
				"Content-type": "application/json"
			}, data, fn);
		};
		methods[method + "Cookies"] = function(url, cookies, data, fn){
			var cookiearr = [];
			for(var key in cookies)
				cookiearr.push(key + "=" + cookies[key]);
			methods[method + "Ex"](url, {
				Cookie: cookiearr.join("; ")
			}, data, fn);
		};
		methods[method+"File"] = function(url, headers, file, fn){
			var formData=new FormData();
			formData.append("buffer", file);
			var config = {
				url: url,
				method: method.toUpperCase(),
				data: formData,
				headers: {
					'Content-Type': undefined
				},
				transformRequest: angular.identity
			};
			if(headers)
				for(var key in headers)
					if(key != 'Content-Type')
						config.headers[key] = headers[key];
			ajax(config, fn);
		};

	});
	return methods;
});
rootApp.controller("navbar", function($scope, $rootScope, auth, req){
  $rootScope.$watchCollection("user", function(){
    if($rootScope.user){
      $scope.welcome = "欢迎，" + $rootScope.user.username;
    }else{
      $scope.welcome = "";
    }
  });
  $scope.signout = auth.signout;
  ["admin", "censor","stat","op"].forEach(function(tag){
    $scope["is" + tag] = function(){
      if(!$rootScope.user) return false;
      return $rootScope.user[tag];
    }
  });
});
rootApp.controller("error", function($scope, $rootScope, auth, req){
});


^^=ctrl$$