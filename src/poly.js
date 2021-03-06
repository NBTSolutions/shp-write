var ext = require('./extent');


var types = require('./types');

module.exports.write = function writePoints(geometries, extent, shpView, shxView, TYPE) {

  var shpI = 0;


  var shxI = 0;


  var shxOffset = 100;

  geometries.forEach(writePolyLine);

  function writePolyLine(coordinates, i) {

    var flattened = justCoords(coordinates);
    var noParts = parts([coordinates], TYPE);
    var contentLength = (flattened.length * 16) + 48 + (noParts - 1) * 4;

    var featureExtent = flattened.reduce(function(extent, c) {
      return ext.enlarge(extent, c);
    }, ext.blank());

    // INDEX
    shxView.setInt32(shxI, shxOffset / 2); // offset
    shxView.setInt32(shxI + 4, contentLength / 2); // offset length

    shxI += 8;
    shxOffset += contentLength + 8;

    shpView.setInt32(shpI, i + 1); // record number
    shpView.setInt32(shpI + 4, contentLength / 2); // length
    shpView.setInt32(shpI + 8, TYPE, true); // POLYLINE=3
    shpView.setFloat64(shpI + 12, featureExtent.xmin, true); // EXTENT
    shpView.setFloat64(shpI + 20, featureExtent.ymin, true);
    shpView.setFloat64(shpI + 28, featureExtent.xmax, true);
    shpView.setFloat64(shpI + 36, featureExtent.ymax, true);
    shpView.setInt32(shpI + 44, noParts, true);
    shpView.setInt32(shpI + 48, flattened.length, true); // POINTS
    shpView.setInt32(shpI + 52, 0, true); // The first part - index zero

    var onlyParts = coordinates.reduce(function (arr, coords) {
      if (Array.isArray(coords[0][0])) {
        arr = arr.concat(coords);
      } else {
        arr.push(coords);
      }
      return arr;
    }, []);
    for (var p = 1; p < noParts; p++) {
      shpView.setInt32( // set part index
        shpI + 52 + (p * 4),
        onlyParts.reduce(function (a, b, idx) {
          return idx < p ? a + b.length : a;
        }, 0),
        true
      );
    }

    flattened.forEach(function writeLine(coords, i) {
      shpView.setFloat64(shpI + 56 + (i * 16) + (noParts - 1) * 4, coords[0], true); // X
      shpView.setFloat64(shpI + 56 + (i * 16) + (noParts - 1) * 4 + 8, coords[1], true); // Y
    });

    shpI += contentLength + 8;
  }
};

module.exports.shpLength = function(geometries) {
  return (geometries.length * 56) +
        // points
        (justCoords(geometries).length * 16);
};

module.exports.shxLength = function(geometries) {
  return geometries.length * 8;
};

module.exports.extent = function(coordinates) {
  return justCoords(coordinates).reduce(function(extent, c) {
    return ext.enlarge(extent, c);
  }, ext.blank());
};

function parts(geometries, TYPE, TOTAL) {
  var no = 1;
  if (TYPE === types.geometries.POLYGON || TYPE === types.geometries.POLYLINE)  {
    // a polyline with a single linestring:
    if (!Array.isArray(geometries[0][0][0])) {
      if (TOTAL === types.geometries.POLYLINE) {
        return geometries.length; // one part per geometry for single polyline
      }
      return no;
    }
    no = geometries.reduce(function (no, coords) {
      no += coords.length;
      if (Array.isArray(coords[0][0][0])) { // multi
        no += coords.reduce(function (no, rings) {
          return no + rings.length - 1; // minus outer
        }, 0);
      }
      return no;
    }, 0);
  }
  return no;
}
module.exports.parts = parts;

function justCoords(coords, l) {
  if (l === undefined) l = [];
  if (typeof coords[0][0] == 'object') {
    return coords.reduce(function(memo, c) {
      return memo.concat(justCoords(c));
    }, l);
  } else {
    return coords;
  }
}
