/**
 * @typedef {{ from: { x: number, y: number, z: number }, to: { x: number, y: number, z: number } }} Line
 * @typedef {'UP' | 'DOWN' | 'LEFT' | 'RIGHT'} Direction
 * @type {Object<string, { x: number, y: number, sign: boolean }>}
 */
const Dir = {
	'UP':    { x: 0, y: -1, sign: false },
	'DOWN':  { x: 0, y:  1, sign: true  },
	'LEFT':  { x: -1, y: 0, sign: false },
	'RIGHT': { x:  1, y: 0, sign: true  }
}

const ease = (/** @type {number} */ x) => x < 0.5 ? (2*x*x) : ((-2*x*x)+(4*x)+-1);
const dist = (/** @type {{ x: number; y: number; }} */ a, /** @type {{ x: number; y: number; }} */ b) => Math.sqrt(((a.x-b.x)*(a.x-b.x))+((a.y-b.y)*(a.y-b.y)))

/** @type {Set<string>} */
var keys = new Set()
function getArrowKeyVector() {
	var v = new THREE.Vector2(0, 0)
	if (keys.has("w") || keys.has("ArrowUp")) v.y -= 1;
	if (keys.has("s") || keys.has("ArrowDown")) v.y += 1;
	if (keys.has("a") || keys.has("ArrowLeft")) v.x -= 1;
	if (keys.has("d") || keys.has("ArrowRight")) v.x += 1;
	return v;
}

const BOARD_SIZE = 30;

var points = 0;
var multiplier = 1;
var pointsDisplay = (() => {
	var e = document.querySelector("#display")
	if (e == null) throw new Error("display element is missing")
	return e
})();

/**
 * @template {any} T
 * @param {T[]} items
 * @returns {T}
 */
function choice(items) { return items[Math.floor(Math.random()*items.length)]; }

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.position.x = 0;
camera.position.y = 15;
camera.position.z = 0;
camera.lookAt(camera.position.x, 0, camera.position.z)

const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setClearColor( 0x000000, 0 );
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

// const controls = new OrbitControls( camera, renderer.domElement );
// controls.target.set(camera.position.x, 0, camera.position.z);
// controls.update();

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
	var vertices_array = []
	for (var i = 0; i < points.length; i++) {
		var p = points[i]
		vertices_array.push(
			p.from.x, p.from.y, p.from.z,
			p.to.x,   p.to.y,   p.to.z
		)
	}
	const vertices = new Float32Array(vertices_array);
	const geometry = new THREE.BufferGeometry( );
	geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
	return geometry
}
/**
 * @param {Line[]} lines
 * @param {number} color
 */
function createMeshFromLines(lines, color) {
	var geometry = makeBufferGeometryFromLines(lines)
	var material = new THREE.LineBasicMaterial( { color } )
	var mesh = new THREE.LineSegments( geometry, material );
	return mesh
}

/** @type {LineObject[]} */
var objects = []

class LineObject {
	/**
	 * @param {number} x
	 * @param {number} y
	 */
	constructor(x, y) {
		this.pos = { x, y }
		this.lines = this.getGeometry()
		this.mesh = createMeshFromLines(this.lines, this.getColor())
		this.mesh.position.set(x, 0, y);
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
	/**
	 * @param {boolean} hasScore
	 */
	destroy(hasScore) {
		this.remove()
		for (var i = 0; i < this.lines.length; i++) {
			var p = new DeathParticle(this.mesh.position.x, this.mesh.position.z, this.lines[i], this.getColor(), this.mesh.rotation.x, this.mesh.rotation.y, this.mesh.rotation.z)
			p.spawn()
		}
	}
}
class DeathParticle extends LineObject {
	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {Line} line
	 * @param {number} color
	 * @param {number} rx
	 * @param {number} ry
	 * @param {number} rz
	 */
	constructor(x, y, line, color, rx, ry, rz) {
		super(x, y)
		this.color = new THREE.Color(color);
		this.mesh = createMeshFromLines([line], color)
		this.mesh.position.set(x, -0.01, y);
		this.mesh.scale.set(0.3, 0.3, 0.3);
		this.mesh.rotation.set(rx, ry, rz)
		this.v = THREE.Vector2.randomUnitVector_KindaBiasedTowardsDiagonals().multiplyScalar(0.05 * Math.random());
		this.rv = (Math.random() - 0.5) * 0.1;
		this.a = 1;
		this.av = 0.001;
	}
	getGeometry() { return [] }
	getColor() { return 0; }
	tick() {
		this.mesh.position.x += this.v.x
		this.mesh.position.z += this.v.y
		this.mesh.rotation.y += this.rv
		this.v.multiplyScalar(0.99)
		this.rv *= 0.99
		this.a -= this.av;
		var displayOpacity = 1 - ((this.a - 1) * (this.a - 1));
		this.mesh.material = new THREE.LineBasicMaterial( { color: this.color.multiplyScalar(displayOpacity) } );
		if (this.a < 0.7) this.remove()
	}
}
class Grid extends LineObject {
	getGeometry() {
		var lines = [
			{
				from: { x: -1, z: -1 },
				to:   { x:  1, z: -1 }
			},
			{
				from: { x: -1, z: -1 },
				to:   { x: -1, z:  1 }
			},
			{
				from: { x:  1, z:  1 },
				to:   { x:  1, z: -1 }
			},
			{
				from: { x:  1, z:  1 },
				to:   { x: -1, z:  1 }
			}
		]
		const P = 0.2
		lines = [
			...lines.map((v) => ({
				from: { x: v.from.x <0 ? 0 : BOARD_SIZE, z: v.from.z <0 ? 0 : BOARD_SIZE },
				to:   { x: v.to.x   <0 ? 0 : BOARD_SIZE, z: v.to.z   <0 ? 0 : BOARD_SIZE }
			})),
			...lines.map((v) => ({
				from: { x: v.from.x <0 ? -P : BOARD_SIZE+P, z: v.from.z <0 ? -P : BOARD_SIZE+P },
				to:   { x: v.to.x   <0 ? -P : BOARD_SIZE+P, z: v.to.z   <0 ? -P : BOARD_SIZE+P }
			}))
		]
		const M = 10/3;
		return lines.map((v) => ({
			from: { x: v.from.x*M, y: 0, z: v.from.z*M },
			to:   { x: v.to.x  *M, y: 0, z: v.to.z  *M }
		}))
	}
	getColor() {
		return 0xFFFFFF;
	}
}
class Player extends LineObject {
	/**
	 * @param {number} x
	 * @param {number} y
	 */
	constructor(x, y) {
		super(x, y)
		this.direction = 0
		this.shootTime = 0
	}
	getGeometry() {
		return [
			{ from: { x: -1,   y: 0, z: -1.4 }, to: { x: -1.8, y: 0, z:  0.2 } }, // top left
			{ from: { x: -1.8, y: 0, z:  0.2 }, to: { x:  0,   y: 0, z:  1.4 } }, // bottom left
			{ from: { x:  0,   y: 0, z:  1.4 }, to: { x:  1.8, y: 0, z:  0.2 } }, // bottom right
			{ from: { x:  1.8, y: 0, z:  0.2 }, to: { x:  1,   y: 0, z: -1.4 } }, // top right
			{ from: { x: -1.6, y: 0, z: -0.2 }, to: { x:  0,   y: 0, z:  0.3 } }, // middle left
			{ from: { x:  0,   y: 0, z:  0.3 }, to: { x:  1.6, y: 0, z: -0.2 } }  // middle right
		]
	}
	getColor() {
		return 0xFF8866;
	}
	tick() {
		this.shootTime -= 1
		// update facing direction
		var newDirectionVector = getArrowKeyVector().normalize()
		if (newDirectionVector.length() != 0) {
			var newDirection = (Math.PI * -0.5) - Math.atan2(newDirectionVector.y, newDirectionVector.x)
			this.direction = newDirection
		}
		newDirectionVector.multiplyScalar(0.06)
		this.pos.x += newDirectionVector.x
		this.pos.y += newDirectionVector.y
		// borders
		if (this.pos.x <= 0) this.pos.x = 0
		if (this.pos.x >= BOARD_SIZE) this.pos.x = BOARD_SIZE
		if (this.pos.y <= 0) this.pos.y = 0
		if (this.pos.y >= BOARD_SIZE) this.pos.y = BOARD_SIZE
		// update camera/mesh positions
		camera.position.x = this.pos.x
		camera.position.z = this.pos.y
		this.mesh.position.x = this.pos.x
		this.mesh.position.z = this.pos.y
		this.mesh.rotation.y = ((this.mesh.rotation.y * 9) + this.direction) / 10
	}
	/**
	 * @param {number} targetX
	 * @param {number} targetY
	 */
	shoot(targetX, targetY) {
		if (this.shootTime > 0) return
		this.shootTime = 20;
		var diffX = targetX - (window.innerWidth  / 2)
		var diffY = targetY - (window.innerHeight / 2)
		var angle = Math.atan2(diffY, diffX)
		for (var bulletAngle of [angle - 0.08, angle, angle + 0.08]) {
			var b = new Bullet(this.pos.x, this.pos.y, Math.cos(bulletAngle), Math.sin(bulletAngle))
			b.spawn()
		}
	}
	destroy() {
		this.remove()
		for (var n = 0; n < 20; n++) {
			for (var i = 0; i < this.lines.length; i++) {
				var p = new DeathParticle(this.mesh.position.x, this.mesh.position.z, this.lines[i], this.getColor(), this.mesh.rotation.x, this.mesh.rotation.y, this.mesh.rotation.z)
				p.spawn()
				p.v.multiplyScalar(2)
				p.av *= 0.25;
			}
		}
	}
	remove() {
		super.remove()
		// destroy everything
		for (var i = 0; i < objects.length; i++) {
			if (objects[i] instanceof Grid) continue;
			if (objects[i] instanceof DeathParticle) continue;
			objects[i].destroy(false);
			i -= 1;
		}
	}
}
class Bullet extends LineObject {
	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {number} vx
	 * @param {number} vy
	 */
	constructor(x, y, vx, vy) {
		super(x, y)
		this.directionXY = new THREE.Vector2(vx, vy).normalize()
		this.directionRad = (Math.PI * -0.5) - Math.atan2(vy, vx)
		this.mesh.rotation.y = this.directionRad
	}
	getGeometry() {
		return [
			{ from: { x: 0,   y: 0, z: 0 }, to: { x: 0.6, y: 0, z: 0 } },
			{ from: { x: 0.6, y: 0, z: 0 }, to: { x: 0.3, y: 0, z: -1.5 } },
			{ from: { x: 0.3,   y: 0, z: -1.5 }, to: { x: 0,   y: 0, z: 0 } }
		]
	}
	getColor() {
		return 0xFF8800;
	}
	tick() {
		this.pos.x += this.directionXY.x * 0.15
		this.pos.y += this.directionXY.y * 0.15
		this.mesh.position.x = this.pos.x
		this.mesh.position.z = this.pos.y
		// check for collisions
		var es = [...objects]
		for (var i = 0; i < es.length; i++) {
			var e = es[i]
			if (e instanceof Enemy) {
				var d = dist(this.pos, e.pos)
				if (d < 0.75) {
					this.remove()
					e.destroy(true)
					return;
				}
			}
		}
		// check for hit walls
		if (this.pos.x < 0) this.destroy(false)
		if (this.pos.y < 0) this.destroy(false)
		if (this.pos.x > BOARD_SIZE) this.destroy(false)
		if (this.pos.y > BOARD_SIZE) this.destroy(false)
	}
}
class EnemySpawner extends LineObject {
	constructor() {
		super(0, 0)
		scene.remove(this.mesh);
		this.time = 0
		this.every = 70
	}
	getGeometry() { return [] }
	getColor() { return 0 }
	tick() {
		this.time += 1
		if (this.time >= this.every) {
			/** @type {(x: number, y: number) => Enemy} */
			var selectedCreator = choice([
				(x, y) => new BlueDiamond(x, y),
				(x, y) => new BlueDiamond(x, y),
				(x, y) => new PinkSquares(x, y),
				(x, y) => new PinkSquares(x, y),
				(x, y) => new Pinwheel(x, y),
				(x, y) => new Pinwheel(x, y),
				(x, y) => new PurpleBox(x, y)
			])
			var newEnemy = selectedCreator(Math.random() * BOARD_SIZE, Math.random() * BOARD_SIZE)
			var spawning = new Spawning(newEnemy)
			spawning.spawn()
			this.every *= 0.99
			this.time = 0
		}
	}
}
class Spawning extends LineObject {
	static spawnTime = 30;
	/**
	 * @param {Enemy} enemy
	 */
	constructor(enemy) {
		super(enemy.pos.x, enemy.pos.y)
		this.enemy = enemy
		// update mesh
		this.mesh = createMeshFromLines(enemy.lines, enemy.getColor())
		this.mesh.position.set(this.pos.x, 0, this.pos.y);
		this.mesh.scale.set(0.3, 0.3, 0.3);
		// time
		this.time = 0
	}
	getGeometry() { return []; }
	getColor() { return 0; }
	tick() {
		if (this.time == Spawning.spawnTime*4) {
			this.enemy.spawn();
			this.remove();
		} else if (this.time % Spawning.spawnTime == 0) {
			(new SpawnWarning(this.enemy)).spawn();
		}
		this.time += 1;
	}
}
class SpawnWarning extends LineObject {
	/**
	 * @param {Enemy} enemy
	 */
	constructor(enemy) {
		super(enemy.pos.x, enemy.pos.y)
		this.enemy = enemy
		// update mesh
		this.mesh = createMeshFromLines(enemy.lines, enemy.getColor())
		this.mesh.position.set(this.pos.x, 0, this.pos.y);
		this.mesh.scale.set(0.3, 0.3, 0.3);
		// time
		this.time = 0
	}
	getGeometry() { return []; }
	getColor() { return 0; }
	tick() {
		this.time += 1;
		var scale = 0.3 + ((0.3 / Spawning.spawnTime) * this.time)
		this.mesh.scale.set(scale, scale, scale);
		if (this.time >= Spawning.spawnTime) {
			this.remove()
		}
	}
}
class Rice extends LineObject {
	/**
	 * @param {number} x
	 * @param {number} y
	 */
	constructor(x, y) {
		super(x, y)
		this.vx = Math.random() - 0.5
		this.vy = Math.random() - 0.5
		this.vr = Math.random() - 0.5
		this.time = 0
	}
	getGeometry() {
		const R = 0.5;
		return [
			{ from: { x:    0, y: 0, z: -R }, to: { x: .5*R, y: 0, z:  0 } }, // (top right)
			{ from: { x: .5*R, y: 0, z:  0 }, to: { x:    0, y: 0, z:  R } }, // (bottom right)
			{ from: { x:    0, y: 0, z:  R }, to: { x:-.5*R, y: 0, z:  0 } }, // (bottom left)
			{ from: { x:-.5*R, y: 0, z:  0 }, to: { x:    0, y: 0, z: -R } }  // (top left)
		]
	}
	getColor() {
		return 0x00FF33;
	}
	tick() {
		for (var i = 0; i < objects.length; i++) {
			var e = objects[i]
			if (! (e instanceof Player)) continue;
			var d = dist(this.pos, e.pos)
			if (d < 1.5) {
				// Pickup
				this.remove()
				multiplier += 1;
				(new RiceCollection(this.pos.x, this.pos.y, this.mesh.rotation.y, e)).spawn();
			}
		}
		// move
		this.pos.x += this.vx * 0.01;
		this.pos.y += this.vy * 0.01;
		// time
		this.time += 1
		if (this.time >= 200) {
			this.mesh.visible = this.time % 2 == 0
		}
		if (this.time >= 300) {
			this.destroy(false)
		}
		// update mesh
		this.mesh.position.x = this.pos.x;
		this.mesh.position.z = this.pos.y;
		this.mesh.rotation.y += this.vr * 0.01;
	}
}
class RiceCollection extends Rice {
	maxTime = 10
	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {number} r
	 * @param {Player} target
	 */
	constructor(x, y, r, target) {
		super(x, y)
		this.mesh.rotation.y = r
		this.target = target
	}
	tick() {
		// time
		this.time += 1
		if (this.time >= this.maxTime) {
			this.remove()
		}
		// find pos
		var targetX = this.target.pos.x;
		var targetY = this.target.pos.y;
		var progress = this.time / this.maxTime
		progress = progress * progress;
		var frameX = this.pos.x + ((targetX - this.pos.x) * progress)
		var frameY = this.pos.y + ((targetY - this.pos.y) * progress)
		// update mesh
		this.mesh.position.x = frameX;
		this.mesh.position.z = frameY;
		this.mesh.rotation.y += this.vr * 0.01;
	}
}
class Enemy extends LineObject {
	tick() {
		// check for collisions
		for (var i = 0; i < objects.length; i++) {
			var e = objects[i]
			if (e instanceof Player) {
				var d = dist(this.pos, e.pos)
				if (d < 0.75) {
					this.destroy(false)
					e.destroy()
					i -= 1;
				}
			}
		}
	}
	/**
	 * @param {boolean} hasScore
	 */
	destroy(hasScore) {
		super.destroy(hasScore)
		if (hasScore) {
			points += multiplier;
			(new Rice(this.pos.x, this.pos.y)).spawn()
		}
	}
}
class BlueDiamond extends Enemy {
	/**
	 * @param {number} x
	 * @param {number} y
	 */
	constructor(x, y) {
		super(x, y)
		this.switchTime = 0;
		/** @type {Enemy} */
		this.target = this;
	}
	getGeometry() {
		const R = 2.5;
		var outsidePoints = [
			// outline
			{ from: { x:    0, z: -R }, to: { x: .5*R, z:  0 } }, // (top right)
			{ from: { x: .5*R, z:  0 }, to: { x:    0, z:  R } }, // (bottom right)
			{ from: { x:    0, z:  R }, to: { x:-.5*R, z:  0 } }, // (bottom left)
			{ from: { x:-.5*R, z:  0 }, to: { x:    0, z: -R } }  // (top left)
		]
		const P = 0.6;
		return [
			...outsidePoints.map((v) => ({
				from: { x: v.from.x, y: 0, z: v.from.z },
				to:   { x: v.to.x,   y: 0, z: v.to.z   }
			})),
			...outsidePoints.map((v) => ({
				from: { x: v.from.x*P, y: 0, z: v.from.z*P },
				to:   { x: v.to.x * P, y: 0, z: v.to.z * P }
			}))
		]
	}
	getColor() {
		return 0x5577CC;
	}
	tick() {
		if ((this.switchTime -= 1) <= 0) {
			this.switchTime = 5;
			this.target = this;
			var targetDist = 1000000;
			for (var i = 0; i < objects.length; i++) {
				if (objects[i] == this) continue;
				if (! (objects[i] instanceof Player)) continue;
				var d = dist(this.pos, objects[i].pos)
				if (d < targetDist) {
					this.target = objects[i];
					targetDist = d;
				}
			}
		}
		// go towards target
		var diff = new THREE.Vector2(this.target.mesh.position.x - this.pos.x, this.target.mesh.position.z - this.pos.y)
		diff = diff.normalize().multiplyScalar(0.03);
		this.pos.x += diff.x;
		this.pos.y += diff.y;
		// update mesh
		this.mesh.position.x = this.pos.x;
		this.mesh.position.z = this.pos.y;
		super.tick()
	}
}
class PinkSquares extends Enemy {
	animPhase1Time = 60*2.5;
	animPhase2Time = 60*3.5;
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
		this.mesh.position.y = 0.15
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
		if (this.animTime == 1) {
			// new direction
			this.direction = choice(['UP', 'DOWN', 'LEFT', 'RIGHT'])
			if (this.direction == 'UP' && this.pos.y <= 0) this.direction = 'DOWN'
			if (this.direction == 'LEFT' && this.pos.x <= 0) this.direction = 'RIGHT'
			if (this.direction == 'DOWN' && this.pos.y >= BOARD_SIZE) this.direction = 'UP'
			if (this.direction == 'RIGHT' && this.pos.x >= BOARD_SIZE) this.direction = 'LEFT'
		}
		if (this.animTime > this.animPhase1Time) {
			// run the animation
			var offsetRotX = 0
			var offsetRotZ = 0
			var offsetPosX = 0
			var offsetPosY = 0
			var offsetPosZ = 0
			if (this.animTime < this.animPhase1Time + this.animPhase2Time) {
				var animProgress = (this.animTime - this.animPhase1Time) / this.animPhase2Time
				animProgress = ease(animProgress)
				// Continue the animation
				if (Dir[this.direction].x == 0) {
					// Rotate the mesh
					offsetRotX += animProgress * Math.PI;
					// Move the mesh
					offsetPosZ += animProgress * Dir[this.direction].y
				} else {
					// Rotate the mesh
					offsetRotZ += animProgress * Math.PI;
					// Move the mesh
					offsetPosX += animProgress * Dir[this.direction].x
				}
				// Move up
				offsetPosY = ((x) => -4*x*(x-1))(animProgress) * 0.3;
				// fix spin direction
				var key = (Dir[this.direction].sign ?'T':'F') + (Dir[this.direction].x == 0 ?'T':'F') + (this.flipped ?'T':'F')
				var shouldReverse = { // I can't figure out how to make this with actual logic so here >:(
					'TFF': true,
					'TTT': false,
					'FTT': true,
					'TFT': false,
					'FTF': true,
					'TTF': false,
					'FFF': false,
					'FFT': true
				}[key]
				// console.log("key:", key, "reversing:", shouldReverse)
				// if (shouldReverse == undefined) this.animPhase2Time = 1200
				// else this.animPhase2Time = this.animPhase1Time = 2
				if (shouldReverse) {
					offsetRotX *= -1
					offsetRotZ *= -1
				}
			} else {
				// reset animation
				this.animTime = 0;
				// set new pos
				this.pos.x += Dir[this.direction].x
				this.pos.y += Dir[this.direction].y
				this.flipped = !this.flipped;
			}
			this.mesh.rotation.x = (this.flipped ? Math.PI : 0) + offsetRotX;
			this.mesh.rotation.z = offsetRotZ;
			this.mesh.position.x = this.pos.x + offsetPosX;
			this.mesh.position.y = 0.15 + 0.0001 + offsetPosY;
			this.mesh.position.z = this.pos.y + offsetPosZ;
		}
		super.tick()
	}
}
class Pinwheel extends Enemy {
	/**
	 * @param {number} x
	 * @param {number} y
	 */
	constructor(x, y) {
		super(x, y)
		this.spinDirection = Math.random() < 0.5 ? -1 : 1
		this.direction = THREE.Vector2.randomUnitVector_KindaBiasedTowardsDiagonals()
	}
	getGeometry() {
		const DEG2RAD = Math.PI / 180;
		const insideRad = 0.2;
		const outsideRad = 1.6;
		/**
		 * Indicates which direction the pinwheel faces.
		 */
		const D = Math.random() < 0.5 ? -1 : 1
		const getCirclePoint = (/** @type {number} */ rot, /** @type {number} */ radius) => {
			var rad = DEG2RAD * rot * 360;
			var x = Math.cos(rad) * radius
			var y = Math.sin(rad) * radius
			return { x: x, y: 0, z: y }
		}
		var lines = []
		// Go through the circle
		for (var i = 0; i < 8; i++) {
			// Inner circle line
			lines.push({
				from: getCirclePoint( i   /8,   insideRad),
				to:   getCirclePoint((i+1)/8, insideRad)
			})
			// Outside fan
			if (i % 2 == 0) {
				// Line out from center
				lines.push({
					from: getCirclePoint(i / 8, insideRad),
					to:   getCirclePoint(i / 8, outsideRad)
				})
				// Line across
				lines.push({
					from: getCirclePoint( i   /8, outsideRad),
					to:   getCirclePoint((i+D)/8, outsideRad*Math.SQRT2)
				})
				// Line back in diagonally
				lines.push({
					from: getCirclePoint((i+D)/8, outsideRad*Math.SQRT2),
					to:   getCirclePoint((i+D)/8, insideRad)
				})
			}
		}
		return lines
	}
	getColor() {
		return 0x8833FF;
	}
	tick() {
		this.mesh.rotation.y += 0.03 * this.spinDirection;
		this.pos.x += this.direction.x * 0.01;
		this.pos.y += this.direction.y * 0.01;
		// bounce
		if (this.pos.x <= 0) {
			this.direction.x = Math.abs(this.direction.x)
		}
		if (this.pos.y <= 0) {
			this.direction.y = Math.abs(this.direction.y)
		}
		if (this.pos.x >= BOARD_SIZE) {
			this.direction.x = -Math.abs(this.direction.x)
		}
		if (this.pos.y >= BOARD_SIZE) {
			this.direction.y = -Math.abs(this.direction.y)
		}
		// set mesh
		this.mesh.position.x = this.pos.x
		this.mesh.position.z = this.pos.y
		super.tick()
	}
}
class PurpleBox extends Enemy {
	/**
	 * @param {number} x
	 * @param {number} y
	 */
	constructor(x, y) {
		super(x, y)
		this.vx = 0
		this.vy = 0
	}
	getGeometry() {
		const S = 2; // half the size of the box (dist. from the center to the edge)
		const H = 3; // the full height of the box (dist. from the bottom to the top)
		const M = 0.45; // the height of the smaller square (dist. from the bottom)
		var outsidePoints = [
			// outside square
			{ from: { x: -S, y: 0, z: -S }, to: { x: -S, y: 0, z:  S } },
			{ from: { x: -S, y: 0, z:  S }, to: { x:  S, y: 0, z:  S } },
			{ from: { x:  S, y: 0, z:  S }, to: { x:  S, y: 0, z: -S } },
			{ from: { x:  S, y: 0, z: -S }, to: { x: -S, y: 0, z: -S } }
		]
		var points = [
			// outside square
			...outsidePoints,
			// inside square
			...outsidePoints.map((v) => ({
				from: { x: v.from.x * (1-M), y: H*M, z: v.from.z * (1-M) },
				to:   { x: v.to.x   * (1-M), y: H*M, z: v.to.z   * (1-M) }
			})),
			// diagonal lines
			...outsidePoints.map((v) => ({
				from: { x: v.from.x, y: 0, z: v.from.z },
				to:   { x:         0, y: H, z:         0 }
			}))
		]
		return points
	}
	getColor() {
		return 0x8833FF;
	}
	tick() {
		/** @type {LineObject} */
		var target = this;
		var targetDist = 1000000;
		for (var i = 0; i < objects.length; i++) {
			if (objects[i] == this) continue;
			if (! (objects[i] instanceof Player)) continue;
			var d = dist(this.pos, objects[i].pos)
			if (d < targetDist) {
				target = objects[i];
				targetDist = d;
			}
		}
		var diff = new THREE.Vector2(target.mesh.position.x - this.pos.x, target.mesh.position.z - this.pos.y)
		diff = diff.normalize().multiplyScalar(0.001);
		this.vx += diff.x
		this.vy += diff.y
		this.vx *= 0.995
		this.vy *= 0.995
		// move
		this.pos.x += this.vx;
		this.pos.y += this.vy;
		// bounce
		if (this.pos.x <= 0) {
			this.vx = 0
			this.pos.x = 0
		}
		if (this.pos.y <= 0) {
			this.vy = 0
			this.pos.y = 0
		}
		if (this.pos.x >= BOARD_SIZE) {
			this.vx = 0
			this.pos.x = BOARD_SIZE
		}
		if (this.pos.y >= BOARD_SIZE) {
			this.vy = 0
			this.pos.y = BOARD_SIZE
		}
		// set mesh
		this.mesh.position.x = this.pos.x
		this.mesh.position.z = this.pos.y
		super.tick()
	}
	/**
	 * @param {boolean} hasScore
	 */
	destroy(hasScore) {
		super.destroy(hasScore)
		if (hasScore) {
			for (var i = 0; i < 3; i++) {
				var p = new PurpleBoxRemnant(this.pos.x + (Math.random() - 0.5), this.pos.y + (Math.random() - 0.5))
				p.spawn();
			}
		}
	}
}
class PurpleBoxRemnant extends Enemy {
	radius = 2
	/**
	 * @param {number} x
	 * @param {number} y
	 */
	constructor(x, y) {
		super(x, y)
		this.mesh.scale.set(0.1, 0.1, 0.1)
		this.deg = Math.random() * 360
		this.center = {
			x: x + (Math.cos(this.deg) * 0.5 * this.radius),
			y: y + (Math.sin(this.deg) * 0.5 * this.radius)
		}
		this.invunTime = 10
	}
	getGeometry() {
		return new PurpleBox(0, 0).getGeometry()
	}
	getColor() {
		return 0x8833FF;
	}
	tick() {
		if (this.invunTime > -0) this.invunTime -= 1;
		// move
		this.deg += 0.1
		this.pos.x = this.center.x + (Math.cos(this.deg) * 0.5 * this.radius)
		this.pos.y = this.center.y + (Math.sin(this.deg) * 0.5 * this.radius)
		// set mesh
		this.mesh.position.x = this.pos.x
		this.mesh.position.z = this.pos.y
		super.tick()
	}
	/**
	 * @param {boolean} hasScore
	 */
	destroy(hasScore) {
		if (this.invunTime <= 0) super.destroy(hasScore)
		else this.invunTime -= 1
	}
}
(new Grid(0, 0)).spawn();
(new EnemySpawner()).spawn();
(new Player(BOARD_SIZE / 2, BOARD_SIZE / 2)).spawn();

// /*
// SVG paths for the different enemies:
// Blue diamond - M 0 0 L 6 0 L 10 6 L 4 6 Z M 0.4 0.6 L 6.4 0.6 M 3.6 5.4 L 9.6 5.4 M 1.2 0.6 L 4.4 5.4 M 5.6 0.6 L 8.8 5.4
// Pinwheel - M 5 4 L 5.7 4.3 L 6 5 L 5.7 5.7 L 5 6 L 4.3 5.7 L 4 5 L 4.3 4.3 L 5 4 L 5 0 L 1 0 L 5 4 M 4 5 L 0 5 L 0 9 L 4 5 M 5 6 L 5 10 L 9 10 L 5 6 M 6 5 L 10 5 L 10 1 L 6 5
// Pink squares - M 0 0 L 0 5 L 5 5 L 5 0 Z M 3 3 L 3 8 L 8 8 L 8 3 Z (copy for front and back, connecting at every point)
// Green square - M 1 1 L 9 1 L 9 9 L 1 9 L 1 1 M 5 1 L 9 5 L 5 9 L 1 5 L 5 1 (copy for front and back, connecting at first 4 points)
// Orange arrow - M 0 0 L 8 5 L 0 10 L 0 0 M -1 4 L 1 4 L 1 6 L -1 6 L -1 4 (copy and rotate, plus line across center from 0,5 to 8,5)

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

var blurcanvas = (() => {
	var c = document.querySelector("#blurcanvas")
	if (c == null) throw new Error("can't find the blur canvas")
	if (! (c instanceof HTMLCanvasElement)) throw new Error("blur canvas is not a canvas")
	c.width = window.innerWidth
	c.height = window.innerHeight
	// get context
	var r = c.getContext('2d')
	if (r == null) throw new Error("canvas has wrong rendering context...?!")
	return r
})();

function animate() {
	// scene
	for (var e of [...objects]) {
		e.tick();
	}
	// render
	renderer.render( scene, camera );
	blurcanvas.fillStyle = "black"
	blurcanvas.fillRect(0, 0, window.innerWidth, window.innerHeight)
	blurcanvas.drawImage(renderer.domElement, 0, 0)
	// score
	pointsDisplay.innerHTML = `Points: ${points}<br><small>x${multiplier}</small>`
	// Animation loop
	requestAnimationFrame(animate)
}
requestAnimationFrame(animate)

// Key listeners
window.addEventListener("keydown", (e) => {
	keys.add(e.key)
})
window.addEventListener("keyup", (e) => {
	keys.delete(e.key)
})
window.addEventListener("mousemove", (e) => {
	// find player
	var s = [...objects]
	for (var i = 0; i < s.length; i++) {
		var o = s[i];
		if (o instanceof Player) {
			o.shoot(e.clientX, e.clientY)
		}
	}
})
