/**
 * Created by aeolu on 10/08/2015.
 */
var shift = {

};
var shiftimage = {

};
var shiftimage_base = {

};
var shift_base = {

};
var rasters = {

};

function redraw() {
	for(var i = 0; i < layers.length; i++) {
		var layer = layers[i];

		if (items[layer] != undefined && items[layer] != '') {
			var element = document.getElementById(items[layer]);

			if (rasters[layer].image != element && shiftimage_base[layer] != element) {
				rasters[layer].image = element;
			}

			if (shift[layer] > 0 && (shiftimage_base[layer] != element || shift_base[layer] != shift[layer])) {
				rasters[layer].visible = false;
				for (var y = 0; y < rasters[layer].height; y++) {
					for(var x = 0; x < rasters[layer].width; x++) {
						// Get the color of the pixel:
						var color = rasters[layer].getPixel(x, y);

						// Set the fill color of the path to the color
						// of the pixel:
						color.hue += shift[layer];

						rasters[layer].setPixel(x, y, color);
					}
				}
				shiftimage_base[layer] = element;
				shift_base[layer] = shift[layer];
				shiftimage[layer].src = rasters[layer].toDataURL();
				rasters[layer].image = shiftimage[layer];
			}

			rasters[layer].visible = true;
		} else {
			rasters[layer].visible = false;
		}
	}
	paper.view.draw();
}

// Only executed our code once the DOM is ready.
$(window).load(function() {
	// Get a reference to the canvas object
	var canvas = document.getElementById('sprite');
	// Create an empty project and a view for the canvas:
	paper.setup(canvas);
	// Create a Paper.js Path to draw a line into it:

	for(var i = 0; i < layers.length; i++) {
		var layer = layers[i];

		rasters[layer] = new paper.Raster();
		rasters[layer].position = paper.view.center;
		shift[layer] = 0;
		shiftimage[layer] = document.createElement('img');
		if (items[layer] != undefined) {
			rasters[layer].image = document.getElementById(items[layer]);
		}
	}

	// Draw the view now:
	paper.view.draw();
});

function setBlendMode(layer, value) {
	rasters[layer].blendMode = value;
	paper.view.draw();
}