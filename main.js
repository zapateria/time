/**
 * SMARTHUB TIME - Timeregistrering
 * @author Anders Nygård <post@andersnygaard.no>
 * @copyright 2015 Anders Nygård andersnygaard.no
 * @description Timeregistreringsapp
 *
 * @todo Update Datepicker when changing activities: Done
 * @todo Move Administrative functions from controller to service: Done
*/

angular.module('ui.bootstrap.datepicker')
    .config(function($provide) {
        $provide.decorator('datepickerDirective', function($delegate) {
            var directive = $delegate[0];
            var link = directive.link;

            directive.compile = function() {
                return function(scope, element, attrs, ctrls) {
                    link.apply(this, arguments);

                    var datepickerCtrl = ctrls[0];
                    var ngModelCtrl = ctrls[1];

                    if (ngModelCtrl) {
                        // Listen for 'refreshDatepickers' event...
                        scope.$on('refreshDatepickers', function refreshView() {
                            datepickerCtrl.refreshView();
                        });
                    }
                }
            };
            return $delegate;
        });
    });

angular.module('rny', [
	'ngRoute',
	'ui.bootstrap',
	'angular-storage',
	'angular-jwt'])
	.config(['$routeProvider', ConfigRouteProvider])
	.config(ConfigInterceptorProvider)
	.controller("MainController", MainController)
	.controller("NewActivityController", NewActivityController)
	.controller("ShowActivityController", ShowActivityController)
	.controller("ReportActivityController", ReportActivityController)
	.controller("AdminController", AdminController)
	.controller("LoginController", LoginController)
	.factory("auth", auth)
	.factory("api", api)
	.run(RunAuthorize);


/**
 * Checks if routed location requires login, and a user is not logged in, then create a login modal to authenticate user before redirecting(reloading)
 * @function RunAuthorize
 */
function RunAuthorize($rootScope, $window, $location, store, jwtHelper, auth) {
	$rootScope.$on('$routeChangeStart', function(event, next) {
		if (next.requireLogin && !auth.getCurrentUser()) {
			event.preventDefault();
			auth.loginModal().then(function(token) {
				/** @todo Redirect to last location */
                var nextPath = "#"+next.originalPath;
                $window.location.reload();
				// Logged in
			});
		}
	});
}


/**
 * Loads the jwt token from browser storage on every request
 * @function ConfigureInterceptorProvider
 * @requires angular-jwt
 * @requires angular-store
 */
function ConfigInterceptorProvider($routeProvider, jwtInterceptorProvider, jwtOptionsProvider, $httpProvider) {
	$routeProvider.otherwise({
		redirectTo: '/'
	});

	jwtInterceptorProvider.tokenGetter = function(store) {
		return store.get('jwt');
	};

	jwtOptionsProvider.config({ whiteListedDomains: ['rny.no','smarthub.no'] });

	$httpProvider.interceptors.push('jwtInterceptor');
}

/**
 * Configures routing and controllers
 * @function ConfigRouteProvider
 * @requires ngRoute
 */
function ConfigRouteProvider($routeProvider) {
	$routeProvider.when('/', {
		templateUrl: 'partials/blank.html',
		controller: 'MainController',
		controllerAs: 'main',
		requireLogin: false
	})
		.when('/login', {
		templateUrl: 'partials/login.html',
		controller: 'LoginController',
		controllerAs: 'login',
		requireLogin: false
	})
		.when('/show', {
		templateUrl: 'partials/show.html',
		controller: 'ShowActivityController',
		controllerAs: 'vm',
		requireLogin: true
	})
		.when('/report', {
		templateUrl: 'partials/report.html',
		controller: 'ReportActivityController',
		controllerAs: 'vm',
		requireLogin: true
	})
		.when('/admin', {
		templateUrl: 'partials/admin.html',
		controller: 'AdminController',
		controllerAs: 'vm',
		requireLogin: true
	})
		.when('/me', {
		templateUrl: 'partials/me.html',
		controller: 'MainController',
		controllerAs: 'vm',
		requireLogin: true
	})
		.when('/add', {
		templateUrl: 'partials/add.html',
		controller: 'NewActivityController',
		controllerAs: 'vm',
		requireLogin: true
	})
		.otherwise({
		redirectTo: '/'
	});
}


/**
 * Factory for interacting with the REST API
 * @ngdoc factory
 */
function api($http) {

	var API_URL = "http://rny.no/api/time/";

	var api = {
		getData: getData,
		getUser: getUser,
		newActivity: newActivity,
		deleteActivity: deleteActivity,
        deleteUser: deleteUser,
        saveUser: saveUser,
        newUser: newUser,
        getUsers: getUsers,
        getSumHours: getSumHours,
        getOvertime: getOvertime,
        workdaysBetween: workdaysBetween,
    };


    function getSumHours(activities) {
		var sumHours = 0;

		if (!activities) return;

		for (var i = 0; i < activities.length; i++) {
		console.log("act: "+activities[i].timeCode+" time: "+activities[i].timeHours);
			switch (activities[i].timeCode) {
				case "Overtid 50%":
				case "Overtid 100%":
					break;
				case "Avspasering Fleksitid":
				case "Permisjon uten lønn":
					sumHours -= activities[i].timeHours;
					break;
                default:
					sumHours += activities[i].timeHours;
					break;
			}
		}

		return sumHours;
	}

    
    function getOvertime(activities) {
        var overtime = { sum: 0, used: 0, worked: 0 };

        if (!activities) return;
		for (var i = 0; i < activities.length; i++) {
			switch (activities[i].timeCode) {
				case "Avspasering Overtid":
					overtime.sum -= activities[i].timeHours;
                    overtime.used += activities[i].timeHours;
                    break;
                case "Overtid 50%":
                case "Overtid 100%":
                case "Overtidstillegg 50%":
                case "Overtidstillegg 100%":
					overtime.sum += activities[i].timeHours;
                    overtime.worked += activities[i].timeHours;
            }
		}
        return overtime;
	}
        
    
    function workdaysBetween(startDate, endDate) {
        // Validate input
        if (endDate < startDate)
            return 0;

        // Calculate days between dates
        var millisecondsPerDay = 86400 * 1000; // Day in milliseconds
        startDate.setHours(0,0,0,1);  // Start just after midnight
        endDate.setHours(23,59,59,999);  // End just before midnight
        var diff = endDate - startDate;  // Milliseconds between datetime objects    
        var days = Math.ceil(diff / millisecondsPerDay);

        // Subtract two weekend days for every week in between
        var weeks = Math.floor(days / 7);
        days = days - (weeks * 2);

        // Handle special cases
        var startDay = startDate.getDay();
        var endDay = endDate.getDay();

        // Remove weekend not previously removed.   
        if (startDay - endDay > 1)         
            days = days - 2;      

        // Remove start day if span starts on Sunday but ends before Saturday
        if (startDay == 0 && endDay != 6)
            days = days - 1  

        // Remove end day if span ends on Saturday but starts after Sunday
        if (endDay == 6 && startDay != 0)
            days = days - 1  

		days--;
		
		console.log("days: "+days);

        return days;
    }
    
	function getUser(userId) {
		return $http.get(API_URL + "/user/" + userId);
	}

	function getData() {
		return $http.get(API_URL + "/users");
	}

	function newActivity(activity) {
		return $http.post(API_URL + "/new",
		JSON.stringify({
			email: activity.email,
			timeFrom: activity.timeFrom,
			timeTo: activity.timeTo,
			timeDate: activity.timeDate,
			timeCode: activity.timeCode,
			timeProject: activity.timeProject,
			timeDescription: activity.timeDescription
		}));
	}

	function deleteActivity(userId, activityId) {
		return $http.delete(API_URL + "/delete/" + userId + "/" + activityId);
	}

    function deleteUser(userId) {
        return $http.delete(API_URL + "/user/delete/" + userId);
    }
    
    function saveUser(user) {
        return $http.put(API_URL + "/user/update/" + user._id, JSON.stringify(user));
    }
    
    function newUser(user) {
        return $http.post(API_URL + "/user", JSON.stringify(user));
    }
    
    function getUsers() {
        return $http.get(API_URL + "/users");
    }

    function logFile(logEntry) {
        return $http.post(API_URL + "/log", JSON.stringify(logEntry));
    }
    
    return api;

}

/** 
 * @description Factory for Authentication and User handling
 * @ngdoc factory
 * @name auth
 * @requires angular-storage
 * @requires angular-jwt
 */
function auth($http, $modal, $rootScope, $location, store, jwtHelper) {

	var API_URL = "http://rny.no/api/time";
	var auth = {
		setToken: setToken,
		getUser: getUser,
		getCurrentUser: getCurrentUser,
		logout: logout,
		loginModal: loginModal,
		submitLogin: submitLogin,
	};


	function submitLogin(email, password) {
		return $http.post(API_URL + "/auth", JSON.stringify({
			email: email,
			password: password
		}))
	}



	function setToken(res) {
		var token = res.token;
		var tokenPayload = jwtHelper.decodeToken(res.token);

		store.set("jwt", token);
		store.set("profile", tokenPayload);
		return (token);
	}

	function getCurrentUser() {
		return store.get("profile");
	}

	function getUser() {
		var token = store.get("jwt");
		if (token) {
			if (jwtHelper.isTokenExpired(token)) {
				alert("Token expired!");
				logout();
			}
			var tokenPayload = jwtHelper.decodeToken(token);
			return tokenPayload;
		}
	}

	function logout() {
		store.remove("jwt");
		store.remove("profile");
		window.location = "/";
	}

	function loginModal() {
		var instance = $modal.open({
			templateUrl: 'partials/login.html',
			controller: 'LoginController',
			controllerAs: 'login'
		})
        
		return instance.result.then(setToken);
	}

	return auth;

}


function AdminController($http, auth, api) {
	var vm = this;

	vm.message = null;

	vm.deleteUser = deleteUser;
	vm.saveUser = saveUser;
	vm.newUser = newUser;
    vm.getUsers = getUsers;
    vm.user = auth.getUser();

    getUsers();
    
	function deleteUser(userId) {
        api.deleteUser(userId).then(function(res) {
			vm.users = res.data;
			vm.message = "Brukeren ble slettet!";
		});
	}

	function saveUser(user) {
        api.saveUser(user).then(function(res) {
			vm.users = res.data;
			vm.message = "Brukeren ble oppdatert!";
		});
	}

	function newUser(user) {
        api.newUser(user)
        .success(function(res) {
            vm.users = res.data;
            vm.message = "New user saved!";
        })
        .error(function(err, res) {
            vm.message = err;
        });
	}

	function getUsers() {
        api.getUsers().then(function(res) {
            vm.users = res.data;
	   });
    }

        
    
}

/** 
 * Controller for the Login Modal
 * @ngdoc controller
 * @name LoginController
 */
function LoginController($scope, $timeout, auth) {

	var vm = this;
	vm.submit = submit;
	vm.cancel = cancel;

	function submit(email, password) {
		auth.submitLogin(email, password)
			.success(function(res) {
			vm.message = null;
			$timeout(function() {
				$scope.$close(res);
			});
		})
			.error(function(err) {
			vm.message = err;
		});
	}

	function cancel() {
		$scope.$dismiss();
	}

}

/** 
 * @ngdoc controller
 * @name NewActivityController
 */

function NewActivityController($scope, auth, api) {
	var vm = this;
	vm.act = [];

	vm.act.searchDate = new Date().setHours(0, 0, 0, 0);
	vm.act.timeDate = new Date().setHours(0, 0, 0, 0);
	vm.act.timeFrom = new Date().setHours(8, 0, 0, 0);
	vm.act.timeTo = new Date().setHours(15, 30, 0, 0);
	vm.timeCodes = ["Normal tid",
		"Overtid 50%",
		"Overtidstillegg 50%",
		"Overtid 100%",
		"Overtidstillegg 100%",
		"Ferie (ordinær)",
		"Velferdspermisjon m/lønn",
		"Sykemelding",
		"Egenmelding",
		"Barns sykdom",
		"Omsorg.-/fødselspermisjon",
		"Avspasering Fleksitid",
		"Avspasering Overtid",
		"Permisjon uten lønn",
		"Helligdag"];

	vm.act.timeCode = vm.timeCodes[0];
	vm.timeProjects = [
        "Smarthub",
		"Smart Strøm Nordvest",
		"Istad AS ITAVD",
        "P1221 Allianselinken - krav spes /teknisk (felles)",
        "P1222 Allianselinken - adm /SG-møter (felles)",
        "P1223 Allianselinken - Datavask (felles)",
        "P1224 Allianselinken - Enoro-aktiviteter",
        "P1225 Allianselinken - CGI-aktiviteter"
    ];
	vm.act.timeProject = vm.timeProjects[0];

	vm.filledDays = [];


	activate();
	vm.selectedMonthFilter = function(item) {
		var itemDate = new Date(item.timeDate).setHours(0, 0, 0, 0);
		var searchDate = new Date(vm.act.timeDate).setHours(0, 0, 0, 0);
		return itemDate === searchDate;
	}

	function activate() {
		return api.getUser(auth.getCurrentUser()._id)
			.success(function(user) {
			vm.user = user;
			vm.act.email = user.email;
			vm.user.activities.forEach(function(act) {
				if (act.timeHours >= 7.5) vm.filledDays.push({
					date: act.timeDate,
					status: 'full'
				});
				else vm.filledDays.push({
					date: act.timeDate,
					status: 'partial'
				});
			});
            $scope.$broadcast('refreshDatepickers');

		})
			.error(function(err) {
			console.log("Unable to load user: " + err);
		});
	}

	vm.delActivity = function(userId, activityId) {

		api.deleteActivity(userId, activityId)
			.success(function(res) {
			vm.user = res;
            activate();
            vm.message = "Slettet aktivitet!";
		})
			.error(function(err, res) {
			alert(err);
		});
	}
	vm.newActivity = function(activity) {

		vm.message = "Registrerer data...";

		api.newActivity(activity)
			.success(function(data) {
			vm.user = data;
			vm.message = "Lagret timeregistrering!";
            activate();
		})
			.error(function(err, data) {
			vm.message = err;
		});
	}


	vm.getDayClass = function(date, mode) {
		var dayToCheck = new Date(date).setHours(0, 0, 0, 0);
		for (var i = 0; i < vm.filledDays.length; i++) {
			var currentDay = new Date(vm.filledDays[i].date).setHours(0, 0, 0, 0);
			if (dayToCheck === currentDay) {
				return vm.filledDays[i].status;
			}
		}
	}


}

function ReportActivityController(api) {

	var vm = this;

	vm.months = [
	new Date(2017, 1, 0),
	new Date(2017, 2, 0),
	new Date(2017, 3, 0),
	new Date(2017, 4, 0),
	new Date(2017, 5, 0),
	new Date(2017, 6, 0),
	new Date(2017, 7, 0),
	new Date(2017, 8, 0),
	new Date(2017, 9, 0),
	new Date(2017, 10, 0),
	new Date(2017, 11, 0),
	new Date(2017, 12, 0)];

    
	vm.filterByMonth = function(item) {
		var itemDate = new Date(item.timeDate).getMonth() + 1 + '/' + new Date(item.timeDate).getFullYear();
		var searchDate = new Date(vm.searchMonth).getMonth() + 1 + '/' + new Date(vm.searchMonth).getFullYear();
		return itemDate === searchDate;
	}

	/**
	 * Sums activities of type
	 * @function getTotalHours
	 * @returns array with timeCode and hours
	 */
	vm.getTotalHours = function(activities) {
		if (!activities) {
			return;
		}
		var totalHours = {};

		activities = activities.filter(vm.filterByMonth);
		activities.forEach(function(act) {
			if (totalHours[act.timeCode] == undefined) totalHours[act.timeCode] = act.timeHours;
			else totalHours[act.timeCode] += act.timeHours;

		});
		return totalHours;

	}

	vm.getSumHours = function(activities) {
		var sumHours = 0;

		if (!activities) return;

		activities = activities.filter(vm.filterByMonth);

		for (var i = 0; i < activities.length; i++) {
			switch (activities[i].timeCode) {
				case "Avspasering Fleksitid":
				case "Permisjon uten lønn":
					sumHours -= activities[i].timeHours;
					break;
				default:
					sumHours += activities[i].timeHours;
			}
		}

		return sumHours;
	}

	vm.printReport = function() {
		window.print();
	}


	vm.getData = function() {
		api.getData()
			.success(function(d) {
			vm.data = d;
		})
			.error(function(err) {
			console.log("Could not get data: " + err);
		});
	}

	vm.getData();

}

function ShowActivityController($scope, auth, api) {
	var vm = this;

	vm.filledDays = [];
	vm.searchMonth = new Date();

/*
    vm.getUser = function() {
		vm.user = auth.getUser();
	}
*/
    activate();
    
    function activate() {
        return api.getUser(auth.getCurrentUser()._id)
            .success(function(user) {
            vm.user = user;
            vm.user.activities.forEach(function(act) {
                if (act.timeHours >= 7.5) vm.filledDays.push({
                    date: act.timeDate,
                    status: 'full'
                });
                else vm.filledDays.push({
                    date: act.timeDate,
                    status: 'partial'
                });
            });
            $scope.$broadcast('refreshDatepickers');

        })
            .error(function(err) {
            console.log("Unable to load user: " + err);
        });
    }

	vm.getTotalHours = function(activities) {
		if (!activities) {
			return;
		}
		var totalHours = {};

		activities = activities.filter(vm.selectedMonthFilter);
		activities.forEach(function(act) {
			if (totalHours[act.timeCode] == undefined) totalHours[act.timeCode] = act.timeHours;
			else totalHours[act.timeCode] += act.timeHours;

		});
		return totalHours;

	}

	vm.delActivity = function(userId, activityId) {

		api.deleteActivity(userId, activityId)
			.success(function(res) {
			vm.user = res;
            activate();
		})
			.error(function(err, res) {
			alert(err);
		});
	}


	vm.selectedMonthFilter = function(item) {
		var itemDate = new Date(item.timeDate).setHours(0, 0, 0, 0);
		var searchDate = new Date(vm.searchMonth).setHours(0, 0, 0, 0);
		return itemDate === searchDate;
	}

	vm.getDayClass = function(date, mode) {
        var dayToCheck = new Date(date).setHours(0, 0, 0, 0);
		for (var i = 0; i < vm.filledDays.length; i++) {
			var currentDay = new Date(vm.filledDays[i].date).setHours(0, 0, 0, 0);

            if (dayToCheck === currentDay) {
				return vm.filledDays[i].status;
			}
		}
	}

}



function MainController($window, $http, auth, api) {

	var vm = this;

	vm.navCollapsed = true;
    
    
    activate();
    
    function activate() {
        vm.user = auth.getUser();
        
        if (!vm.user)
            return;
        
        api.getUser(vm.user._id)
			.success(function(user) {
			vm.userData = user;

            var sortedActivities = vm.userData.activities.sort(function(a,b) {
                return new Date(a.timeDate) - new Date(b.timeDate);
            });
            var firstActivityDate = new Date();
            if (sortedActivities.length > 0)
                firstActivityDate = new Date(sortedActivities[0].timeDate);
            vm.firstDate = firstActivityDate;
            vm.myHours = api.getSumHours(vm.userData.activities);
            vm.overtime = api.getOvertime(vm.userData.activities);
			console.log(firstActivityDate);
			console.log(new Date());
            vm.workHours = api.workdaysBetween(firstActivityDate, new Date())*7.5;
//			console.log(vm.myHours);
        })
			.error(function(err) {
			console.log("Unable to load userdata: " + err);
		});
    
    }
    

	vm.login = function() {
		auth.loginModal().then(function(token) {
            $window.location.reload();
        });
	}

	vm.logout = function() {
		auth.logout();
	}

    
}
