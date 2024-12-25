const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

const controls = new OrbitControls( camera, renderer.domElement );
controls.update();

// make a cube
(() => {
	const geometry = new THREE.BoxGeometry( 1, 1, 1 );
	const material = new THREE.MeshLambertMaterial( { color: 0x00ff00 } );
	const cube = new THREE.Mesh( geometry, material );
	scene.add( cube );
})();

// make some lights
(() => {
	const light = new THREE.AmbientLight( 0xffffff, 0.1 );
	scene.add( light );
})();
(() => {
	const light = new THREE.DirectionalLight( 0xffffff, 1 );
	light.position.set(4, 3, 5);
	light.lookAt(0, 0, 0);
	scene.add( light );
})();

function animate() {
	renderer.render( scene, camera );
	// Animation loop
	requestAnimationFrame(animate)
}
requestAnimationFrame(animate)
