var app = angular.module('GraveApp', ['ngAnimate', 'mgcrea.ngStrap']);

app.config(['$asideProvider', function($asideProvider) {
    angular.extend($asideProvider.defaults, {
      container: 'body',
      backdrop: false,
      animation: 'am-fade-and-slide-right'
    });
  }
]);

app.controller('MapCtrl', ['$scope', '$http', '$aside', '$alert', function($scope, $http, $aside, $alert) {

    $scope.busy = false;
    $scope.static = {
      'api': "https://overpass-api.de/api/interpreter?data=",
      'background': "http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    };

    $scope.map;
    $scope.graves = {
      layer: new L.LayerGroup(),
      data: {}
    };
    $scope.active = {};

    var aside = $aside({
      content: '',
      template: "templates/sidebar.html",
      scope: $scope,
      show: false
    });
    aside.isOpen = function() {
      return document.querySelector(".aside") === null ? false : true;
    };

    /**
     * Init map
     * @returns {void}
     */
    $scope.initMap = function() {
      $scope.map = L.map('map', {
        center: [52, 19.5],
        zoom: 7,
        layers: [new L.tileLayer($scope.static.background, {
            attributionControl: false,
            maxZoom: 21,
            maxNativeZoom: 19,
            opacity: .8
          }), $scope.graves.layer]
      });
      new L.Hash($scope.map);
      $scope.map.attributionControl.setPrefix('');
    };
    $scope.initMap();

    $scope.search = function() {
      $scope.busy = true;
      $http({
        method: 'GET',
        dataType: 'json',
        url: 'https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent($scope.searchText) + '&format=json'
      }).
              success(function(data) {
                $scope.busy = false;
                console.log(data);
                if (data.length > 0) {
                  var item = data[0];
                  $scope.map.setView([item.lat, item.lon]);
                  if ($scope.map.getZoom() < 15)
                    $scope.map.setZoom(15);
                }
              }).
              error(function(data, status) {
                $scope.busy = false;
                alert(data);
              });
    };

    ////////////////////////////////////////////////////////////////// LOADING AND PARSING DATA ////
    ////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * Loading data from overpass API
     * @returns {void}
     */
    $scope.loadData = function() {
      var b = $scope.map.getBounds();
      var bbox = '(' + b.getSouthEast().lat + ',' + b.getNorthWest().lng + ',' +
              b.getNorthWest().lat + ',' + b.getSouthEast().lng + ')';

      $scope.busy = true;
      $http({
        method: 'GET',
        dataType: 'jsonp',
        url: $scope.static.api + encodeURIComponent('[out:json];relation["type"="person"]' + bbox + ';>>;out;')

      }).
              success(function(data) {
                $scope.busy = false;
                $scope.parseData(data.elements);
              }).
              error(function(data, status) {
                $scope.busy = false;
                alert(data);
              });
    };

    /**
     * Parsing data to building object
     * @param {Object} data input from Overpass API
     * @returns {void}
     */
    $scope.parseData = function(data) {
      var graves = {};

      for (var i in data) {
        var item = data[i];
        if (item.type === "node")
          graves[item.id] = {
            id: item.id,
            type: "node",
            latlng: [item.lat, item.lon],
            tags: item.tags,
            people: []
          };
      }

      for (var i in data) {
        var item = data[i];
        //2. ways
        if (item.type === "way") {
          var latlngs = [];
          for (var j = 0; j < item.nodes.length; j++) {
            var k = item.nodes[j];
            latlngs.push(graves[k].latlng);
          }
          graves[item.id] = {
            id: item.id,
            type: "way",
            latlngs: latlngs,
            tags: item.tags,
            people: []
          };
        }
      }

      for (var i in data) {
        var item = data[i];
        if (item.type === "relation") {
          var person = {
            id: item.id,
            name: item.tags.name,
            tags: item.tags,
          };

          for (var j in item.members) {
            var member = item.members[j];
            if (member.role === "tomb")
              graves[member.ref].people.push(person);
          }
        }
      }

      $scope.graves.data = graves;
      $scope.graves.layer.clearLayers();
      for (var i in graves)
        if (graves[i].tags)
          $scope.drawGrave(i);
    };

    /////////////////////////////////////////////////////////////////////////////////// DRAWING ////
    ////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * Opening active building
     * @returns {void}
     */
    $scope.openGrave = function() {
      if (!aside.isOpen())
        aside.show();
    };

    /**
     * Closing acrive building
     * @returns {void}
     */
    $scope.closeGrave = function() {
    };

    /**
     * Drawing building outline/shell
     * @param {Integer} id building relation ID
     * @returns {void}
     */
    $scope.drawGrave = function(id) {

      if ($scope.graves.data[id] === 'undefined') {
        alert('No building with ID: ' + id);
        return false;
      }

      var grave = $scope.graves.data[id];
      if (grave.type === "node") {
        L.marker(grave.latlng, {})
                .on('click', function() {
                  $scope.active = $scope.graves.data[id];
                  $scope.openGrave();
                  $scope.$apply();
                  console.log($scope.active);
                })
                .addTo($scope.graves.layer);
      }
      else if (grave.type === "way") {
        L.polygon(grave.latlngs, {})
                .on('click', function() {
                  $scope.active = $scope.graves.data[id];
                  $scope.openGrave();
                  $scope.$apply();
                  console.log($scope.active);
                })
                .addTo($scope.graves.layer);
      }
    };
  }]);
