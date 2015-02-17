angular.module('CarbonFootprintCalculator', ['ui.bootstrap.buttons'])

.controller('mainController', function($scope, $http) {

	$scope.formData = {};
	$scope.dates = {min: "", max: ""};

	/**
	 * Layers
	 */
	var osm = new L.TileLayer(
		'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			minZoom: 8,
			maxZoom: 20,
			attribution: 'Map data &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
		});

	var ocm = new L.TileLayer(
		'http://{s}.tile.opencyclemap.org/cycle/{z}/{x}/{y}.png', {
			minZoom: 8,
			maxZoom: 20,
			attribution: 'Map data &copy; <a href="http://www.opencyclemap.org">OpenCycleMap</a> contributors'
		});

	/**
	 * Set up the map
	 */
	var map = new L.Map('map', {
		center: new L.LatLng(50.6372, 3.0633),
		zoom: 12,
		layers:[ osm ]
	});

	/**
	 * Init cluster variable
	 */
	map._markersClusterGroup = new L.MarkerClusterGroup({
		singleMarkerMode: true,
		maxClusterRadius: 40
	});

	/**
	 * Update user list.
	 *
	 * Note: Definitely not the best solution, but it works
	 */
	$scope.updateUsersList = function() {
		var updateList = function(users) {
			//$('#optionDefault').text("-- Loading --");
			$scope.users = [] // delete all users from $scope.users
			users.forEach(function(user) {
				$http.get('/api/' + user.user + '/' + $scope.dates.min.yyyymmdd() + '/' + $scope.dates.max.yyyymmdd())
					.success(function(data) {
						// rides founds
						if(data.length > 0) {
							$scope.users.push(user);
							//console.log(user.user+" : "+user.dates[0]);
						}

					})
					.error(function(data) {
						console.log('Error: ' + data);
					});
			});
		};
		$http.get('/api/users')
			.success( updateList )
			.error(function(data) {
				console.log('Error: ' + data);
			});
	}

	/**
	 * Get all rides and associate informations
	 */
	$scope.getCarbonFootprint = function() {
		showContentLoading();
		var userId = $scope.userId,
			min  = $scope.dates.min,
			max  = $scope.dates.max;

		$http.get('/api/' + userId + '/' + min.yyyymmdd() + '/' + max.yyyymmdd())
			.success(function(data) {
				console.log('getCarbonFootprint entered');
				//$scope.rides = data;
				//var adapter = new RidesAdapter(data.success);
        		//var rides = adapter.computeRides();
        		$scope.rides = data;

				// no rides
				if(data.length <= 0) {
					$(".alert").show();
				} else {
					$(".alert").hide();
				}

				/*
				 * - Compute the global footprint
				 * - Compute the global footprint per km
				 * - Aggregate successive rides using the same transportation
				 */
				var totalEmission = 0.;
				var totalDistance = 0.;
				$scope.aggRides = [];
				data.forEach(function (ride, index) {
					totalEmission += ride.emission;
					totalDistance += ride.distance;
					var date = new Date(ride.coordinates[0].timestamp);

					// aggregation
					var prev = $scope.aggRides.length - 1;
					if(prev >= 0 && $scope.aggRides[prev].type === ride.type) {

						$scope.aggRides[prev].distance += ride.distance;
						$scope.aggRides[prev].emission += ride.emission;
						$scope.aggRides[prev].numberOfRides += 1;
						$scope.aggRides[prev].date = date.toDateString();

					} else {
						// define path color
						var colorClass;
						switch(ride.type) {
						case 'train':
							colorClass = 'bg-table-train'; break;
						case 'car':
							colorClass = 'bg-table-car'; break;
						case 'walking':
							colorClass = 'bg-table-walking'; break;
						case 'undefined':
							colorClass = 'bg-table-undefined'; break;
						default:
							colorClass = '';
						}

						$scope.aggRides.push({
							type: ride.type,
							distance: ride.distance,
							emission: ride.emission,
							numberOfRides: 1,
							colorClass: colorClass,
							date: date.toDateString()
						});
					}
				});

				$scope.carbonFootprint = totalEmission.toFixed(1) + ' kg eq. CO₂';
				$scope.carbonFootprintPerKm = (totalEmission/totalDistance).toFixed(2) + ' kg eq. CO₂ per km';

				// Rides layers and clusters layers
				clearMap(map);
				hideContentLoading();
				addContent(map, data);
				//$scope.setIntervalDate(new Date(), new Date());
			})
			.error(function(data) {
				console.log('Error: ' + data);
				hideContentLoading();
			});
	};

	/**
	 * Show/hide the clusters layer
	 */
	$scope.toggleClusters = function() {
		if ($scope.bClusters) {
			map.addLayer(map._markersClusterGroup);
		} else {
			map.removeLayer(map._markersClusterGroup);
		}
	};

	/**
	 * Show/hide the OpenCycleMap layer
	 */
	$scope.toggleCycleMap = function() {
		if ($scope.bCycleMap) {
			map.addLayer(ocm);
		} else {
			map.removeLayer(ocm);
		}
	};

	$scope.setIntervalDate = function(dateMin, dateMax) {
		$('#dpFrom').datepicker({
			startDate: dateMin,
			endDate: dateMax
		});
		$('#dpFrom').datepicker("setDate", dateMin);

		$('#dpTo').datepicker({
			startDate: dateMin,
			endDate: dateMax
		});
		var d = dateMax;
		$('#dpTo').datepicker("setDate", new Date( d.getFullYear(), d.getMonth(), d.getDate() ));
		//if dateMax is the today's day date, we have to split the date like previous line. $('#dpFrom').datepicker("setDate", dateMax); will not work for no reason.
	};

	$scope.setMinDate = function(userId) {
		$scope.users.forEach(function(user) {
			if(user.user == userId) {
				console.log(user.dates[0]);
				$('#dpFrom').datepicker({
					startDate: user.dates[0],
					endDate: new Date()
				});
				var d = user.dates[0].split('-');
				var min = new Date( d[0], d[1]-1, d[2] );
				//$('#dpFrom').datepicker("option", "minDate", min); /* not working */
				$("#dpFrom").datepicker({
    				minDate: min  
				});
				$('#dpFrom').datepicker("setDate", min);
			}
		});
	}

})

.directive('cfcDatescalendars', function() {
	return {
		restrict: 'A',
		require	: 'ngModel',
		link : function ($scope, element, attrs, ngModelCtrl) {
			$(function() {

				$scope.setIntervalDate(new Date(2013, 10, 02), new Date());
				$scope.dates.min = new Date(2013, 10, 02);
				$scope.dates.max = new Date();
				$scope.updateUsersList();

                element.on('changeDate', function(e) {
                	//var nameCalendar = e.target.id;
                	$scope.dates.min = $( "#dpFrom" ).datepicker( "getDate" );
					$scope.dates.max = $( "#dpTo" ).datepicker( "getDate" );

                	// update users list
			    	//$scope.updateUsersList();

			    	// No user selected
			    	if ($scope.userId == undefined) {
			    		return;
			    	};

			    	// Update data
			    	$scope.getCarbonFootprint($scope.userId);
                });
				
			});
		}
	};
});

/**
 * Clear all rides off the map
 */
function clearMap(m) {
    for(i in m._layers) {
        if(m._layers[i]._path == undefined) {
        	continue;
        }

        try {
            m.removeLayer(m._layers[i]);
        } catch(e) {
            console.log("problem with " + e + m._layers[i]);
        }
    }
}

/**
 * Look over the rides list and draw rides
 */
function addContent(map, rides) {
	map._markersClusterGroup.clearLayers();

	rides.forEach(function(ride) {
		/*
		 * Build a array of all position and make markers
		 * to give some information about the current position (speed, etc.)
		 */
		var latLonArray = [];
		ride.coordinates.forEach(function(coord, index) {
			var latlng = L.latLng(coord.latitude, coord.longitude)

			latLonArray.push( latlng );
			map._markersClusterGroup.addLayer( new L.Marker(latlng) );
		});

		// define path color
		var color;
		switch(ride.type) {
		case 'plane' :
			color = 'black'; break;
		case 'train':
			color = 'blue'; break;
		case 'car':
			color = 'red'; break;
		case 'walking':
			color = 'green'; break;
		default:
			color = 'gray';
		}

		/*
		 * Draw line between each point
		 */
		var p = L.polyline(latLonArray, {color: color})
				 .addTo(map)
		  		 .bindPopup('Total distance: '+ ride.distance.toFixed(3) +' km<br>\
		    Average speed: '+ ride.averageSpeed.toFixed(1) +' km/h<br>\
		    Average acceleration: '+ ride.averageAcc.toFixed(3) +' m/s&sup2;<br>\
		    Max speed: '+ ride.maxSpeed.toFixed(1) +' km/h<br>\
		    Carbon Footprint: '+ ride.emission.toFixed(1) +' Kg eq. CO₂');
		console.log('Distance :'+ride.distance.toFixed(3));
		console.log("Average speed:"+ride.averageSpeed.toFixed(1));
		console.log("Max speed:"+ride.maxSpeed.toFixed(1));
	});
}