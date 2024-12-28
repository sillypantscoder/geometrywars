/**
 * @typedef {{ from: { x: number, y: number, z: number }, to: { x: number, y: number, z: number } }} Line
 * @typedef {'UP' | 'DOWN' | 'LEFT' | 'RIGHT'} Direction
 * @type {Object<Direction, { x: number, y: number }>}
 */
const Direction = {
	'UP':    { x: 0, y: -1 },
	'DOWN':  { x: 0, y:  1 },
	'LEFT':  { x: -1, y: 0 },
	'RIGHT': { x:  1, y: 0 }
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.position.x = 0;
camera.position.y = 5;
camera.position.z = 0;

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

const controls = new OrbitControls( camera, renderer.domElement );
controls.target.set(camera.position.x, 0, camera.position.z);
controls.update();

// make a cube
// (() => {
// 	const geometry = new THREE.BoxGeometry( 1, 1, 1 );
// 	const material = new THREE.MeshLambertMaterial( { color: 0x00FF00 } );
// 	const cube = new THREE.Mesh( geometry, material );
// 	scene.add( cube );
// })();

// make some lights
(() => {
	const light = new THREE.AmbientLight( 0xFFFFFF, 0.1 );
	scene.add( light );
})();
(() => {
	const light = new THREE.DirectionalLight( 0xFFFFFF, 1 );
	light.position.set(4, 3, 5);
	light.lookAt(0, 0, 0);
	scene.add( light );
})();

/**
 * @param {Line[]} points
 * @returns {ThreeBufferGeometry}
 */
function makeBufferGeometryFromLines(points) {
	const geometry = new THREE.BufferGeometry( );
	var vertices_array = []
	for (var i = 0; i < points.length; i++) {
		var p = points[i]
		vertices_array.push(
			p.from.x, p.from.y, p.from.z,
			p.to.x,   p.to.y,   p.to.z
		)
	}
	const vertices = new Float32Array(vertices_array);
	// itemSize = 3 because there are 3 values (components) per vertex
	geometry.setAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );
	return geometry
}

/** @type {Enemy[]} */
var objects = []

class Enemy {
	/**
	 * @param {number} x
	 * @param {number} y
	 */
	constructor(x, y) {
		this.pos = { x, y }
		var geometry = makeBufferGeometryFromLines(this.getGeometry())
		var material = new THREE.LineBasicMaterial( { color: this.getColor(), linewidth: 1000000000000000 } );
		this.mesh = new THREE.LineSegments( geometry, material );
		this.mesh.position.set(y, 0, y);
		this.mesh.scale.set(0.3, 0.3, 0.3);
	}
	/** @returns {Line[]} */
	getGeometry() {
		throw new Error("Hey you can't do that :/ (somebody tried to create an enemy without specifying which enemy to create)")
	}
	/** @returns {number} */
	getColor() {
		throw new Error("Hey you can't do that :/ (somebody tried to create an enemy without specifying which enemy to create)")
	}
	/**
	 * @param {number} x
	 * @param {number} y
	 */
	setPos(x, y) {
		this.pos.x = x
		this.pos.y = y
		this.mesh.position.set(x, 0, y);
	}
	spawn() {
		objects.push(this);
		scene.add(this.mesh);
	}
	tick() {}
	remove() {
		objects.splice(objects.indexOf(this), 1)
		scene.remove(this.mesh);
	}
}
class Grid extends Enemy {
	getGeometry() {
		var lines = []
		for (var x = 0; x < 10; x++) {
			for (var y = 0; y < 10; y++) {
				lines.push({
					from: { x: x,   y: 0, z: y },
					to:   { x: x+1, y: 0, z: y }
				})
				lines.push({
					from: { x: x, y: 0, z: y   },
					to:   { x: x, y: 0, z: y+1 }
				})
			}
		}
		return lines
	}
	getColor() {
		return 0x888888;
	}
}
class PinkSquares extends Enemy {
	animPhase1Time = 60;
	animPhase2Time = 120;
	/**
	 * @param {number} x
	 * @param {number} y
	 */
	constructor(x, y) {
		super(x, y)
		this.animTime = 0
		this.flipped = false
		/** @type {Direction} */
		this.direction = 'UP';
	}
	getGeometry() {
		var frontPoints = [
			// top left square
			{ from: { x: -1.5, y: 0.5, z: -1.5 }, to: { x: -1.5, y: 0.5, z:  0.5 } },
			{ from: { x: -1.5, y: 0.5, z:  0.5 }, to: { x:  0.5, y: 0.5, z:  0.5 } },
			{ from: { x:  0.5, y: 0.5, z:  0.5 }, to: { x:  0.5, y: 0.5, z: -1.5 } },
			{ from: { x:  0.5, y: 0.5, z: -1.5 }, to: { x: -1.5, y: 0.5, z: -1.5 } }
		]
		// bottom right square
		frontPoints.push(...frontPoints.map((v) => ({
			from: { x: v.from.x + 1, y: 0.5, z: v.from.z + 1 },
			to:   { x: v.to.x   + 1, y: 0.5, z: v.to.z   + 1 }
		})));
		return [
			// squares
			...frontPoints,
			// squares but shifted down (2nd copy)
			...frontPoints.map((v) => ({
				from: { x: v.from.x, y: -0.5, z: v.from.z },
				to:   { x: v.to.x,   y: -0.5, z: v.to.z   }
			})),
			// Lines from normal to shifted down
			...frontPoints.map((v) => ({
				from: { x: v.from.x, y:  0.5, z: v.from.z },
				to:   { x: v.from.x, y: -0.5, z: v.from.z }
			}))
		];
	}
	getColor() {
		return 0xFF11FF;
	}
	tick() {
		this.animTime += 1;
		if (this.animTime > this.animPhase1Time) {
			if (Direction[this.direction].x == 0) {
				// Rotate the mesh
				this.mesh.rotation.x = this.flipped ? (Math.PI) : 0;
				this.mesh.rotation.x -= (this.animTime - this.animPhase1Time) * (Math.PI / this.animPhase2Time);
				// Move the mesh
				this.mesh.position.z = this.pos.y
				this.mesh.position.z += (this.animTime - this.animPhase1Time) * (Direction[this.direction].y / this.animPhase2Time)
			}
		}
		if (this.animTime > this.animPhase1Time + this.animPhase2Time) {
			// reset animation
			this.animTime = 0;
			// set new pos
			this.pos.x += Direction[this.direction].x
			this.pos.y += Direction[this.direction].y
			this.flipped = !this.flipped;
			// Fix rotation
			this.mesh.rotation.x = this.flipped ? (Math.PI) : 0;
			this.mesh.rotation.z = 0;
			this.mesh.position.x = this.pos.x;
			this.mesh.position.z = this.pos.y;
		}
	}
}
(new Grid(0, 0)).spawn();
(new PinkSquares(0, 0)).spawn();

// // Blue Diamond: make a cool looking line thingy
// (() => {
// 	const geometry = makeBufferGeometryFromLines([
// 		// outline
// 		{ from: { x:   0, y: 0, z:   0 }, to: { x:   6, y: 0, z:   0 } },
// 		{ from: { x:   6, y: 0, z:   0 }, to: { x:  10, y: 0, z:   6 } },
// 		{ from: { x:  10, y: 0, z:   6 }, to: { x:   4, y: 0, z:   6 } },
// 		{ from: { x:   4, y: 0, z:   6 }, to: { x:   0, y: 0, z:   0 } },
// 		// top/bottom sides
// 		{ from: { x:  .4, y: 0, z:  .6 }, to: { x: 6.4, y: 0, z:  .6 } },
// 		{ from: { x: 3.6, y: 0, z: 5.4 }, to: { x: 9.6, y: 0, z: 5.4 } },
// 		// left/right sides
// 		{ from: { x: 1.2, y: 0, z: 0.6 }, to: { x: 4.4, y: 0, z: 5.4 } },
// 		{ from: { x: 5.6, y: 0, z: 0.6 }, to: { x: 8.8, y: 0, z: 5.4 } }
// 	]);
// 	const material = new THREE.LineBasicMaterial( { color: 0x6688FF, linewidth: 1000000000000000 } );
// 	const lines = new THREE.LineSegments( geometry, material );
// 	scene.add( lines );
// 	lines.position.set(5, 0, 0);
// 	lines.scale.set(0.3, 0.3, 0.3);
// })();
// /*
// SVG paths for the different enemies:
// Blue diamond - M 0 0 L 6 0 L 10 6 L 4 6 Z M 0.4 0.6 L 6.4 0.6 M 3.6 5.4 L 9.6 5.4 M 1.2 0.6 L 4.4 5.4 M 5.6 0.6 L 8.8 5.4
// Pinwheel - M 5 4 L 5.7 4.3 L 6 5 L 5.7 5.7 L 5 6 L 4.3 5.7 L 4 5 L 4.3 4.3 L 5 4 L 5 0 L 1 0 L 5 4 M 4 5 L 0 5 L 0 9 L 4 5 M 5 6 L 5 10 L 9 10 L 5 6 M 6 5 L 10 5 L 10 1 L 6 5
// Pink squares - M 0 0 L 0 5 L 5 5 L 5 0 Z M 3 3 L 3 8 L 8 8 L 8 3 Z (copy for front and back, connecting at every point)
// Green square - M 1 1 L 9 1 L 9 9 L 1 9 L 1 1 M 5 1 L 9 5 L 5 9 L 1 5 L 5 1 (copy for front and back, connecting at first 4 points)
// Orange arrow - M 0 0 L 8 5 L 0 10 L 0 0 M -1 4 L 1 4 L 1 6 L -1 6 L -1 4 (copy and rotate, plus line across center from 0,5 to 8,5)

//  */
// // Green Square:
// (() => {
// 	var frontPoints = [
// 		// outline
// 		{ from: { x: 0, y: 0, z: 0 }, to: { x: 6, y: 0, z: 0 } },
// 		{ from: { x: 6, y: 0, z: 0 }, to: { x: 6, y: 0, z: 6 } },
// 		{ from: { x: 6, y: 0, z: 6 }, to: { x: 0, y: 0, z: 6 } },
// 		{ from: { x: 0, y: 0, z: 6 }, to: { x: 0, y: 0, z: 0 } },
// 		// inside
// 		{ from: { x: 3, y: 0, z: 0 }, to: { x: 6, y: 0, z: 3 } },
// 		{ from: { x: 6, y: 0, z: 3 }, to: { x: 3, y: 0, z: 6 } },
// 		{ from: { x: 3, y: 0, z: 6 }, to: { x: 0, y: 0, z: 3 } },
// 		{ from: { x: 0, y: 0, z: 3 }, to: { x: 3, y: 0, z: 0 } }
// 	]
// 	const geometry = makeBufferGeometryFromLines([
// 		...frontPoints,
// 		...frontPoints.map((v) => ({
// 			from: { x: v.from.x, y: -1.5, z: v.from.z },
// 			to:   { x: v.to.x,   y: -1.5, z: v.to.z   }
// 		})),
// 		...frontPoints.slice(0, 4).map((v) => ({
// 			from: { x: v.from.x, y: 0,    z: v.from.z },
// 			to:   { x: v.from.x, y: -1.5, z: v.from.z }
// 		}))
// 	]);
// 	const material = new THREE.LineBasicMaterial( { color: 0x55FF66, linewidth: 1000000000000000 } );
// 	const lines = new THREE.LineSegments( geometry, material );
// 	scene.add( lines );
// 	lines.position.set(0, 0, 5);
// 	lines.scale.set(0.3, 0.3, 0.3);
// })();
// // Pink squares:
// (() => {
// 	var frontPoints = [
// 		// top left square
// 		{ from: { x: 0, y: 0, z: 0 }, to: { x: 0, y: 0, z: 4 } },
// 		{ from: { x: 0, y: 0, z: 4 }, to: { x: 4, y: 0, z: 4 } },
// 		{ from: { x: 4, y: 0, z: 4 }, to: { x: 4, y: 0, z: 0 } },
// 		{ from: { x: 4, y: 0, z: 0 }, to: { x: 0, y: 0, z: 0 } }
// 	]
// 	// bottom right square
// 	frontPoints.push(...frontPoints.map((v) => ({
// 		from: { x: v.from.x + 2.5, y: 0, z: v.from.z + 2.5 },
// 		to:   { x: v.to.x   + 2.5, y: 0, z: v.to.z   + 2.5 }
// 	})));
// 	const geometry = makeBufferGeometryFromLines([
// 		// squares
// 		...frontPoints,
// 		// squares but shifted down (2nd copy)
// 		...frontPoints.map((v) => ({
// 			from: { x: v.from.x, y: -1.5, z: v.from.z },
// 			to:   { x: v.to.x,   y: -1.5, z: v.to.z   }
// 		})),
// 		// Lines from normal to shifted down
// 		...frontPoints.map((v) => ({
// 			from: { x: v.from.x, y: 0,    z: v.from.z },
// 			to:   { x: v.from.x, y: -1.5, z: v.from.z }
// 		}))
// 	]);
// 	const material = new THREE.LineBasicMaterial( { color: 0xFF11FF, linewidth: 1000000000000000 } );
// 	const lines = new THREE.LineSegments( geometry, material );
// 	scene.add( lines );
// 	lines.position.set(2, 0, 2);
// 	lines.scale.set(0.3, 0.3, 0.3);
// })();
// // Black holes:
// function generateBlackHolePoints() {
// 	const DEG2RAD = Math.PI / 180;
// 	// Keep track of the points on the inside and
// 	// outside circles separately
// 	var pointsOutside = []
// 	var pointsInside = []
// 	// Go through the circle
// 	for (var i = 0; i <= 1; i += 1/32) {
// 		// Generate points
// 		var rad = DEG2RAD * i * 360;
// 		var x = Math.cos(rad)
// 		var y = Math.sin(rad)
// 		pointsOutside.push({ x: (x * 4) + 2, y: (y * 4) + 2 })
// 		x *= 0.8; y *= 0.8;
// 		pointsInside.push({ x: (x * 4) + 2, y: (y * 4) + 2 })
// 	}
// 	var lines = []
// 	for (var i = 0; i < pointsOutside.length; i++) {
// 		if (i > 0) {
// 			// Outside circle lines
// 			lines.push({
// 				from: { x: pointsOutside[i - 1].x, y: 0, z: pointsOutside[i - 1].y },
// 				to:   { x: pointsOutside[i].x,     y: 0, z: pointsOutside[i].y     }
// 			})
// 			// Inside circle lines
// 			lines.push({
// 				from: { x: pointsInside[i - 1].x, y: 0, z: pointsInside[i - 1].y },
// 				to:   { x: pointsInside[i].x,     y: 0, z: pointsInside[i].y     }
// 			})
// 		}
// 		if (i > 1 && i % 2 == 0) {
// 			// Connecting lines
// 			lines.push({
// 				from: { x: pointsInside[i - 2].x, y: 0, z: pointsInside[i - 2].y },
// 				to:   { x: pointsOutside[i].x,    y: 0, z: pointsOutside[i].y    }
// 			})
// 		}
// 	}
// 	return lines
// }
// // (Regular black hole)
// (() => {
// 	const geometry = makeBufferGeometryFromLines(generateBlackHolePoints());
// 	const material = new THREE.LineBasicMaterial( { color: 0xDD6688, linewidth: 1000000000000000 } );
// 	const lines = new THREE.LineSegments( geometry, material );
// 	scene.add( lines );
// 	lines.position.set(5, 0, 5);
// 	lines.scale.set(0.3, 0.3, 0.3);
// })();
// // (About-to-die black hole)
// (() => {
// 	const geometry = makeBufferGeometryFromLines(generateBlackHolePoints());
// 	const material = new THREE.LineBasicMaterial( { color: 0xFF3344, linewidth: 1000000000000000 } );
// 	const lines = new THREE.LineSegments( geometry, material );
// 	scene.add( lines );
// 	lines.position.set(7, 0, 3);
// 	lines.scale.set(0.3, 0.3, 0.3);
// })();
// // Orange arrow:
// (() => {
// 	var planePoints = [
// 		// arrow
// 		{ from: { x: 0, y: 0, z:  0 }, to: { x: 8, y: 0, z:  5 } }, // 0, 0 => 8, 5
// 		{ from: { x: 8, y: 0, z:  5 }, to: { x: 0, y: 0, z: 10 } }, // 0, 10
// 		{ from: { x: 0, y: 0, z: 10 }, to: { x: 0, y: 0, z:  0 } }, // 0, 0
// 		// box
// 		{ from: { x: -1, y: 0, z: 4 }, to: { x:  1, y: 0, z: 4 } }, // -1, 4 => 1, 4
// 		{ from: { x:  1, y: 0, z: 4 }, to: { x:  1, y: 0, z: 6 } }, // 1, 6
// 		{ from: { x:  1, y: 0, z: 6 }, to: { x: -1, y: 0, z: 6 } }, // -1, 6
// 		{ from: { x: -1, y: 0, z: 6 }, to: { x: -1, y: 0, z: 4 } } // -1, 4
// 	]
// 	const geometry = makeBufferGeometryFromLines([
// 		...planePoints,
// 		...planePoints.map((v) => ({
// 			from: { x: v.from.x, y: v.from.z - 5, z: 5 },
// 			to:   { x: v.to.x,   y: v.to.z   - 5, z: 5 }
// 		})),
// 		{
// 			from: { x: 0, y: 0, z: 5 },
// 			to:   { x: 8, y: 0, z: 5 }
// 		}
// 	]);
// 	const material = new THREE.LineBasicMaterial( { color: 0xFF8800, linewidth: 1000000000000000 } );
// 	const lines = new THREE.LineSegments( geometry, material );
// 	scene.add( lines );
// 	lines.position.set(-3, 0, 3);
// 	lines.scale.set(0.3, 0.3, 0.3);
// })();
// // Pinwheel:
// function generatePinwheelPoints() {
// 	const DEG2RAD = Math.PI / 180;
// 	const insideRad = 0.5;
// 	const outsideRad = 4;
// 	const getCirclePoint = (/** @type {number} */ rot, /** @type {number} */ radius) => {
// 		var rad = DEG2RAD * rot * 360;
// 		var x = Math.cos(rad) * radius
// 		var y = Math.sin(rad) * radius
// 		return { x: x + outsideRad, y: 0, z: y + outsideRad }
// 	}
// 	var lines = []
// 	// Go through the circle
// 	for (var i = 0; i < 8; i++) {
// 		// Inner circle line
// 		lines.push({
// 			from: getCirclePoint( i   /8,   insideRad),
// 			to:   getCirclePoint((i+1)/8, insideRad)
// 		})
// 		// Outside fan
// 		if (i % 2 == 0) {
// 			// Line out from center
// 			lines.push({
// 				from: getCirclePoint(i / 8, insideRad),
// 				to:   getCirclePoint(i / 8, outsideRad)
// 			})
// 			// Line across
// 			lines.push({
// 				from: getCirclePoint( i   /8, outsideRad),
// 				to:   getCirclePoint((i+1)/8, outsideRad*Math.SQRT2)
// 			})
// 			// Line back in diagonally
// 			lines.push({
// 				from: getCirclePoint((i+1)/8, outsideRad*Math.SQRT2),
// 				to:   getCirclePoint((i+1)/8, insideRad)
// 			})
// 		}
// 	}
// 	return lines
// }
// (() => {
// 	const geometry = makeBufferGeometryFromLines(generatePinwheelPoints());
// 	const material = new THREE.LineBasicMaterial( { color: 0x8833FF, linewidth: 1000000000000000 } );
// 	const lines = new THREE.LineSegments( geometry, material );
// 	scene.add( lines );
// 	lines.position.set(2, 0, -3);
// 	lines.scale.set(0.3, 0.3, 0.3);
// })();
// // Purple boxes:
// function generatePurpleBoxPoints() {
// 	const S = 2; // half the size of the box (dist. from the center to the edge)
// 	const H = 3; // the full height of the box (dist. from the bottom to the top)
// 	const M = 0.45; // the height of the smaller square (dist. from the bottom)
// 	var outsidePoints = [
// 		// outside square
// 		{ from: { x: -S, y: 0, z: -S }, to: { x: -S, y: 0, z:  S } },
// 		{ from: { x: -S, y: 0, z:  S }, to: { x:  S, y: 0, z:  S } },
// 		{ from: { x:  S, y: 0, z:  S }, to: { x:  S, y: 0, z: -S } },
// 		{ from: { x:  S, y: 0, z: -S }, to: { x: -S, y: 0, z: -S } }
// 	]
// 	var points = [
// 		// outside square
// 		...outsidePoints.map((v) => ({
// 			from: { x: v.from.x + S, y: 0, z: v.from.z + S },
// 			to:   { x: v.to.x   + S, y: 0, z: v.to.z   + S }
// 		})),
// 		// inside square
// 		...outsidePoints.map((v) => ({
// 			from: { x: v.from.x * (1-M), y: H*M, z: v.from.z * (1-M) },
// 			to:   { x: v.to.x   * (1-M), y: H*M, z: v.to.z   * (1-M) }
// 		})).map((v) => ({
// 			from: { x: v.from.x + S, y: v.from.y, z: v.from.z + S },
// 			to:   { x: v.to.x   + S, y: v.to.y,   z: v.to.z   + S }
// 		})),
// 		// diagonal lines
// 		...outsidePoints.map((v) => ({
// 			from: { x: v.from.x + S, y: 0, z: v.from.z + S },
// 			to:   { x:            S, y: H, z:            S }
// 		}))
// 	]
// 	return points
// }
// (() => {
// 	const geometry = makeBufferGeometryFromLines(generatePurpleBoxPoints());
// 	const material = new THREE.LineBasicMaterial( { color: 0x7700FF, linewidth: 1000000000000000 } );
// 	const lines = new THREE.LineSegments( geometry, material );
// 	scene.add( lines );
// 	lines.position.set(-1, 0, 1.5);
// 	lines.scale.set(0.3, 0.3, 0.3);
// })();
// (() => {
// 	const geometry = makeBufferGeometryFromLines(generatePurpleBoxPoints());
// 	const material = new THREE.LineBasicMaterial( { color: 0x7700FF, linewidth: 1000000000000000 } );
// 	const lines = new THREE.LineSegments( geometry, material );
// 	scene.add( lines );
// 	lines.position.set(0.5, 0, 2.5);
// 	lines.scale.set(0.1, 0.1, 0.1);
// })();
// // Proton
// function generateProtonPoints() {
// 	const DEG2RAD = Math.PI / 180;
// 	const getCirclePoint = (/** @type {number} */ rot, /** @type {number} */ radius) => {
// 		var rad = DEG2RAD * rot * 360;
// 		var x = Math.cos(rad) * radius
// 		var y = Math.sin(rad) * radius
// 		return { x: x, y: 0, z: y }
// 	}
// 	var lines = []
// 	// Go through the circle
// 	for (var i = 0; i < 1; i += 0.2) {
// 		// Outside
// 		lines.push({
// 			from: getCirclePoint(i+0.0, 0.8),
// 			to:   getCirclePoint(i+0.2, 0.8)
// 		})
// 		// Middle
// 		lines.push({
// 			from: getCirclePoint(i+0.05, 0.45),
// 			to:   getCirclePoint(i+0.25, 0.45)
// 		})
// 		// Inside
// 		lines.push({
// 			from: getCirclePoint(i+0.1, 0.2),
// 			to:   getCirclePoint(i+0.3, 0.2)
// 		})
// 	}
// 	return lines
// }
// (() => {
// 	const geometry = makeBufferGeometryFromLines(generateProtonPoints());
// 	const material = new THREE.LineBasicMaterial( { color: 0x33BBFF, linewidth: 1000000000000000 } );
// 	const lines = new THREE.LineSegments( geometry, material );
// 	scene.add( lines );
// 	lines.position.set(7.7, 0, 5.5);
// 	lines.scale.set(0.3, 0.3, 0.3);
// })();

function animate() {
	// scene
	for (var e of [...objects]) {
		e.tick();
	}
	// render
	renderer.render( scene, camera );
	// Animation loop
	requestAnimationFrame(animate)
}
requestAnimationFrame(animate)
