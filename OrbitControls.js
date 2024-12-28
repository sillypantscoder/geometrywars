// OrbitControls performs orbiting, dollying (zooming), and panning.
// Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
//
//    Orbit - left mouse / touch: one-finger move
//    Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
//    Pan - right mouse, or left mouse + ctrl/meta/shiftKey, or arrow keys / touch: two-finger move

const OrbitControls = (() => {
	const _changeEvent = { type: 'change' };
	const _startEvent = { type: 'start' };
	const _endEvent = { type: 'end' };
	const _ray = new THREE.Ray();
	const _plane = new THREE.Plane();
	const _TILT_LIMIT = Math.cos( 70 * THREE.MathUtils.DEG2RAD );

	const _v = new THREE.Vector3();
	const _twoPI = 2 * Math.PI;

	const _STATE = {
		NONE: - 1,
		ROTATE: 0,
		DOLLY: 1,
		PAN: 2,
		TOUCH_ROTATE: 3,
		TOUCH_PAN: 4,
		TOUCH_DOLLY_PAN: 5,
		TOUCH_DOLLY_ROTATE: 6
	};
	const _EPS = 0.000001;

	class OrbitControls extends THREE.Controls {

		/**
		 * @param {ThreeCamera} object
		 * @param {HTMLCanvasElement | null} domElement
		 */
		constructor( object, domElement = null ) {

			super( object, domElement );

			this.state = _STATE.NONE;

			// Set to false to disable this control
			this.enabled = true;

			// "target" sets the location of focus, where the object orbits around
			this.target = new THREE.Vector3();

			// Sets the 3D cursor (similar to Blender), from which the maxTargetRadius takes effect
			this.cursor = new THREE.Vector3();

			// How far you can dolly in and out ( PerspectiveCamera only )
			this.minDistance = 0;
			this.maxDistance = Infinity;

			// How far you can zoom in and out ( OrthographicCamera only )
			this.minZoom = 0;
			this.maxZoom = Infinity;

			// Limit camera target within a spherical area around the cursor
			this.minTargetRadius = 0;
			this.maxTargetRadius = Infinity;

			// How far you can orbit vertically, upper and lower limits.
			// Range is 0 to Math.PI radians.
			this.minPolarAngle = 0; // radians
			this.maxPolarAngle = Math.PI; // radians

			// How far you can orbit horizontally, upper and lower limits.
			// If set, the interval [ min, max ] must be a sub-interval of [ - 2 PI, 2 PI ], with ( max - min < 2 PI )
			this.minAzimuthAngle = - Infinity; // radians
			this.maxAzimuthAngle = Infinity; // radians

			// Set to true to enable damping (inertia)
			// If damping is enabled, you must call controls.update() in your animation loop
			this.enableDamping = false;
			this.dampingFactor = 0.05;

			// This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
			// Set to false to disable zooming
			this.enableZoom = true;
			this.zoomSpeed = 1.0;

			// Set to false to disable rotating
			this.enableRotate = true;
			this.rotateSpeed = 1.0;
			this.keyRotateSpeed = 1.0;

			// Set to false to disable panning
			this.enablePan = true;
			this.panSpeed = 1.0;
			this.screenSpacePanning = true; // if false, pan orthogonal to world-space direction camera.up
			this.keyPanSpeed = 7.0;	// pixels moved per arrow key push
			this.zoomToCursor = false;

			// Set to true to automatically rotate around the target
			// If auto-rotate is enabled, you must call controls.update() in your animation loop
			this.autoRotate = false;
			this.autoRotateSpeed = 2.0; // 30 seconds per orbit when fps is 60

			// The four arrow keys
			this.keys = { LEFT: 'ArrowLeft', UP: 'ArrowUp', RIGHT: 'ArrowRight', BOTTOM: 'ArrowDown' };

			// Mouse buttons
			this.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };

			// Touch fingers
			this.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

			// for reset
			this.target0 = this.target.clone();
			this.position0 = this.object.position.clone();
			this.zoom0 = this.object.zoom;

			// the target DOM element for key events
			/** @type {Element | null} */
			this._domElementKeyEvents = null;

			// internals

			this._lastPosition = new THREE.Vector3();
			this._lastQuaternion = new THREE.Quaternion();
			this._lastTargetPosition = new THREE.Vector3();

			// so camera.up is the orbit axis
			this._quat = new THREE.Quaternion().setFromUnitVectors( object.up, new THREE.Vector3( 0, 1, 0 ) );
			this._quatInverse = this._quat.clone().invert();

			// current position in spherical coordinates
			this._spherical = new THREE.Spherical();
			this._sphericalDelta = new THREE.Spherical();

			this._scale = 1;
			this._panOffset = new THREE.Vector3();

			this._rotateStart = new THREE.Vector2();
			this._rotateEnd = new THREE.Vector2();
			this._rotateDelta = new THREE.Vector2();

			this._panStart = new THREE.Vector2();
			this._panEnd = new THREE.Vector2();
			this._panDelta = new THREE.Vector2();

			this._dollyStart = new THREE.Vector2();
			this._dollyEnd = new THREE.Vector2();
			this._dollyDelta = new THREE.Vector2();

			this._dollyDirection = new THREE.Vector3();
			this._mouse = new THREE.Vector2();
			this._performCursorZoom = false;

			/**
			 * @type {number[]}
			 */
			this._pointers = [];
			/**
			 * @type {Object<number, ThreeVector2>}
			 */
			this._pointerPositions = {};

			this._controlActive = false;

			// event listeners
			this.bound = {
				onPointerDown: this.onPointerDown.bind(this),
				onPointerUp: this.onPointerUp.bind(this),
				onContextMenu: this.onContextMenu.bind(this),
				onMouseWheel: this.onMouseWheel.bind(this),
				interceptControlDown: this.interceptControlDown.bind(this),
				interceptControlUp: this.interceptControlUp.bind(this)
			}

			//

			if ( this.domElement !== null ) {

				this.connect();

			}

			this.update();

		}

		connect() {

			if (this.domElement == null) throw new Error("dom element is null! You have to specify an element for orbitcontrols")

			this.domElement.addEventListener( 'pointerdown', this.bound.onPointerDown );
			this.domElement.addEventListener( 'pointercancel', this.bound.onPointerUp );

			this.domElement.addEventListener( 'contextmenu', this.bound.onContextMenu );
			this.domElement.addEventListener( 'wheel', this.bound.onMouseWheel, { passive: false } );

			const document = this.domElement.getRootNode(); // offscreen canvas compatibility
			document.addEventListener( 'keydown', this.bound.interceptControlDown, { passive: true, capture: true } );

			this.domElement.style.touchAction = 'none'; // disable touch scroll

		}

		disconnect() {

			if (this.domElement == null) throw new Error("dom element is null! You have to specify an element for orbitcontrols")

			this.domElement.removeEventListener( 'pointerdown', this.bound.onPointerDown );
			this.domElement.removeEventListener( 'pointermove', this.onPointerMove.bind(this) );
			this.domElement.removeEventListener( 'pointerup', this.bound.onPointerUp );
			this.domElement.removeEventListener( 'pointercancel', this.bound.onPointerUp );

			this.domElement.removeEventListener( 'wheel', this.bound.onMouseWheel );
			this.domElement.removeEventListener( 'contextmenu', this.bound.onContextMenu );

			this.stopListenToKeyEvents();

			const document = this.domElement.getRootNode(); // offscreen canvas compatibility
			document.removeEventListener( 'keydown', this.bound.interceptControlDown, { capture: true } );

			this.domElement.style.touchAction = 'auto';

		}

		dispose() {

			this.disconnect();

		}

		getPolarAngle() {

			return this._spherical.phi;

		}

		getAzimuthalAngle() {

			return this._spherical.theta;

		}

		getDistance() {

			return this.object.position.distanceTo( this.target );

		}

		stopListenToKeyEvents() {

			if ( this._domElementKeyEvents !== null ) {

				this._domElementKeyEvents.removeEventListener( 'keydown', this.onKeyDown.bind(this) );
				this._domElementKeyEvents = null;

			}

		}

		saveState() {

			this.target0.copy( this.target );
			this.position0.copy( this.object.position );
			this.zoom0 = this.object.zoom;

		}

		reset() {

			this.target.copy( this.target0 );
			this.object.position.copy( this.position0 );
			this.object.zoom = this.zoom0;

			this.object.updateProjectionMatrix();
			this.dispatchEvent( _changeEvent );

			this.update();

			this.state = _STATE.NONE;

		}

		update( deltaTime = null ) {

			const position = this.object.position;

			_v.copy( position ).sub( this.target );

			// rotate offset to "y-axis-is-up" space
			_v.applyQuaternion( this._quat );

			// angle from z-axis around y-axis
			this._spherical.setFromVector3( _v );

			if ( this.autoRotate && this.state === _STATE.NONE ) {

				this._rotateLeft( this._getAutoRotationAngle( deltaTime ) );

			}

			if ( this.enableDamping ) {

				this._spherical.theta += this._sphericalDelta.theta * this.dampingFactor;
				this._spherical.phi += this._sphericalDelta.phi * this.dampingFactor;

			} else {

				this._spherical.theta += this._sphericalDelta.theta;
				this._spherical.phi += this._sphericalDelta.phi;

			}

			// restrict theta to be between desired limits

			let min = this.minAzimuthAngle;
			let max = this.maxAzimuthAngle;

			if ( isFinite( min ) && isFinite( max ) ) {

				if ( min < - Math.PI ) min += _twoPI; else if ( min > Math.PI ) min -= _twoPI;

				if ( max < - Math.PI ) max += _twoPI; else if ( max > Math.PI ) max -= _twoPI;

				if ( min <= max ) {

					this._spherical.theta = Math.max( min, Math.min( max, this._spherical.theta ) );

				} else {

					this._spherical.theta = ( this._spherical.theta > ( min + max ) / 2 ) ?
						Math.max( min, this._spherical.theta ) :
						Math.min( max, this._spherical.theta );

				}

			}

			// restrict phi to be between desired limits
			this._spherical.phi = Math.max( this.minPolarAngle, Math.min( this.maxPolarAngle, this._spherical.phi ) );

			this._spherical.makeSafe();


			// move target to panned location

			if ( this.enableDamping === true ) {

				this.target.addScaledVector( this._panOffset, this.dampingFactor );

			} else {

				this.target.add( this._panOffset );

			}

			// Limit the target distance from the cursor to create a sphere around the center of interest
			this.target.sub( this.cursor );
			this.target.clampLength( this.minTargetRadius, this.maxTargetRadius );
			this.target.add( this.cursor );

			let zoomChanged = false;
			// adjust the camera position based on zoom only if we're not zooming to the cursor or if it's an ortho camera
			// we adjust zoom later in these cases
			if ( this.zoomToCursor && this._performCursorZoom || this.object.isOrthographicCamera ) {

				this._spherical.radius = this._clampDistance( this._spherical.radius );

			} else {

				const prevRadius = this._spherical.radius;
				this._spherical.radius = this._clampDistance( this._spherical.radius * this._scale );
				zoomChanged = prevRadius != this._spherical.radius;

			}

			_v.setFromSpherical( this._spherical );

			// rotate offset back to "camera-up-vector-is-up" space
			_v.applyQuaternion( this._quatInverse );

			position.copy( this.target ).add( _v );

			this.object.lookAt( this.target );

			if ( this.enableDamping === true ) {

				this._sphericalDelta.theta *= ( 1 - this.dampingFactor );
				this._sphericalDelta.phi *= ( 1 - this.dampingFactor );

				this._panOffset.multiplyScalar( 1 - this.dampingFactor );

			} else {

				this._sphericalDelta.set( 0, 0, 0 );

				this._panOffset.set( 0, 0, 0 );

			}

			// adjust camera position
			if ( this.zoomToCursor && this._performCursorZoom ) {

				let newRadius = null;
				if ( this.object.isPerspectiveCamera ) {

					// move the camera down the pointer ray
					// this method avoids floating point error
					const prevRadius = _v.length();
					newRadius = this._clampDistance( prevRadius * this._scale );

					const radiusDelta = prevRadius - newRadius;
					this.object.position.addScaledVector( this._dollyDirection, radiusDelta );
					this.object.updateMatrixWorld();

					zoomChanged = !! radiusDelta;

				} else if ( this.object.isOrthographicCamera ) {

					// adjust the ortho camera position based on zoom changes
					const mouseBefore = new THREE.Vector3( this._mouse.x, this._mouse.y, 0 );
					mouseBefore.unproject( this.object );

					const prevZoom = this.object.zoom;
					this.object.zoom = Math.max( this.minZoom, Math.min( this.maxZoom, this.object.zoom / this._scale ) );
					this.object.updateProjectionMatrix();

					zoomChanged = prevZoom !== this.object.zoom;

					const mouseAfter = new THREE.Vector3( this._mouse.x, this._mouse.y, 0 );
					mouseAfter.unproject( this.object );

					this.object.position.sub( mouseAfter ).add( mouseBefore );
					this.object.updateMatrixWorld();

					newRadius = _v.length();

				} else {

					console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled.' );
					this.zoomToCursor = false;

				}

				// handle the placement of the target
				if ( newRadius !== null ) {

					if ( this.screenSpacePanning ) {

						// position the orbit target in front of the new camera position
						this.target.set( 0, 0, - 1 )
							.transformDirection( this.object.matrix )
							.multiplyScalar( newRadius )
							.add( this.object.position );

					} else {

						// get the ray and translation plane to compute target
						_ray.origin.copy( this.object.position );
						_ray.direction.set( 0, 0, - 1 ).transformDirection( this.object.matrix );

						// if the camera is 20 degrees above the horizon then don't adjust the focus target to avoid
						// extremely large values
						if ( Math.abs( this.object.up.dot( _ray.direction ) ) < _TILT_LIMIT ) {

							this.object.lookAt( this.target );

						} else {

							_plane.setFromNormalAndCoplanarPoint( this.object.up, this.target );
							_ray.intersectPlane( _plane, this.target );

						}

					}

				}

			} else if ( this.object.isOrthographicCamera ) {

				const prevZoom = this.object.zoom;
				this.object.zoom = Math.max( this.minZoom, Math.min( this.maxZoom, this.object.zoom / this._scale ) );

				if ( prevZoom !== this.object.zoom ) {

					this.object.updateProjectionMatrix();
					zoomChanged = true;

				}

			}

			this._scale = 1;
			this._performCursorZoom = false;

			// update condition is:
			// min(camera displacement, camera rotation in radians)^2 > EPS
			// using small-angle approximation cos(x/2) = 1 - x^2 / 8

			if ( zoomChanged ||
				this._lastPosition.distanceToSquared( this.object.position ) > _EPS ||
				8 * ( 1 - this._lastQuaternion.dot( this.object.quaternion ) ) > _EPS ||
				this._lastTargetPosition.distanceToSquared( this.target ) > _EPS ) {

				this.dispatchEvent( _changeEvent );

				this._lastPosition.copy( this.object.position );
				this._lastQuaternion.copy( this.object.quaternion );
				this._lastTargetPosition.copy( this.target );

				return true;

			}

			return false;

		}

		/**
		 * @param {number | null} deltaTime
		 */
		_getAutoRotationAngle( deltaTime ) {

			if ( deltaTime !== null ) {

				return ( _twoPI / 60 * this.autoRotateSpeed ) * deltaTime;

			} else {

				return _twoPI / 60 / 60 * this.autoRotateSpeed;

			}

		}

		/**
		 * @param {number} delta
		 */
		_getZoomScale( delta ) {

			const normalizedDelta = Math.abs( delta * 0.01 );
			return Math.pow( 0.95, this.zoomSpeed * normalizedDelta );

		}

		/**
		 * @param {number} angle
		 */
		_rotateLeft( angle ) {

			this._sphericalDelta.theta -= angle;

		}

		/**
		 * @param {number} angle
		 */
		_rotateUp( angle ) {

			this._sphericalDelta.phi -= angle;

		}

		/**
		 * @param {number} distance
		 * @param {ThreeMatrix4} objectMatrix
		 */
		_panLeft( distance, objectMatrix ) {

			_v.setFromMatrixColumn( objectMatrix, 0 ); // get X column of objectMatrix
			_v.multiplyScalar( - distance );

			this._panOffset.add( _v );

		}

		/**
		 * @param {number} distance
		 * @param {ThreeMatrix4} objectMatrix
		 */
		_panUp( distance, objectMatrix ) {

			if ( this.screenSpacePanning === true ) {

				_v.setFromMatrixColumn( objectMatrix, 1 );

			} else {

				_v.setFromMatrixColumn( objectMatrix, 0 );
				_v.crossVectors( this.object.up, _v );

			}

			_v.multiplyScalar( distance );

			this._panOffset.add( _v );

		}

		// deltaX and deltaY are in pixels; right and down are positive
		/**
		 * @param {number} deltaX
		 * @param {number} deltaY
		 */
		_pan( deltaX, deltaY ) {

			const element = this.domElement;
			if (element == null) throw new Error("You need to set the element of the orbit controls")

			if ( this.object.isPerspectiveCamera ) {

				// perspective
				const position = this.object.position;
				_v.copy( position ).sub( this.target );
				let targetDistance = _v.length();

				// half of the fov is center to top of screen
				targetDistance *= Math.tan( ( this.object.fov / 2 ) * Math.PI / 180.0 );

				// we use only clientHeight here so aspect ratio does not distort speed
				this._panLeft( 2 * deltaX * targetDistance / element.clientHeight, this.object.matrix );
				this._panUp( 2 * deltaY * targetDistance / element.clientHeight, this.object.matrix );

			} else if ( this.object.isOrthographicCamera && this.object instanceof THREE.OrthographicCamera ) {

				// orthographic
				this._panLeft( deltaX * ( this.object.right - this.object.left ) / this.object.zoom / element.clientWidth, this.object.matrix );
				this._panUp( deltaY * ( this.object.top - this.object.bottom ) / this.object.zoom / element.clientHeight, this.object.matrix );

			} else {

				// camera neither orthographic nor perspective
				console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.' );
				this.enablePan = false;

			}

		}

		/**
		 * @param {number} dollyScale
		 */
		_dollyOut( dollyScale ) {

			if ( this.object.isPerspectiveCamera || this.object.isOrthographicCamera ) {

				this._scale /= dollyScale;

			} else {

				console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
				this.enableZoom = false;

			}

		}

		/**
		 * @param {number} dollyScale
		 */
		_dollyIn( dollyScale ) {

			if ( this.object.isPerspectiveCamera || this.object.isOrthographicCamera ) {

				this._scale *= dollyScale;

			} else {

				console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
				this.enableZoom = false;

			}

		}

		/**
		 * @param {number} x
		 * @param {number} y
		 */
		_updateZoomParameters( x, y ) {

			if ( ! this.zoomToCursor ) {

				return;

			}

			if (this.domElement == null) throw new Error("missing dom element");

			this._performCursorZoom = true;

			const rect = this.domElement.getBoundingClientRect();
			const dx = x - rect.left;
			const dy = y - rect.top;
			const w = rect.width;
			const h = rect.height;

			this._mouse.x = ( dx / w ) * 2 - 1;
			this._mouse.y = - ( dy / h ) * 2 + 1;

			this._dollyDirection.set( this._mouse.x, this._mouse.y, 1 ).unproject( this.object ).sub( this.object.position ).normalize();

		}

		/**
		 * @param {number} dist
		 */
		_clampDistance( dist ) {

			return Math.max( this.minDistance, Math.min( this.maxDistance, dist ) );

		}

		//
		// event callbacks - update the object state
		//

		/**
		 * @param {MouseEvent} event
		 */
		_handleMouseDownRotate( event ) {

			this._rotateStart.set( event.clientX, event.clientY );

		}

		/**
		 * @param {MouseEvent} event
		 */
		_handleMouseDownDolly( event ) {

			this._updateZoomParameters( event.clientX, event.clientX );
			this._dollyStart.set( event.clientX, event.clientY );

		}

		/**
		 * @param {MouseEvent} event
		 */
		_handleMouseDownPan( event ) {

			this._panStart.set( event.clientX, event.clientY );

		}

		/**
		 * @param {MouseEvent} event
		 */
		_handleMouseMoveRotate( event ) {

			this._rotateEnd.set( event.clientX, event.clientY );

			this._rotateDelta.subVectors( this._rotateEnd, this._rotateStart ).multiplyScalar( this.rotateSpeed );

			const element = this.domElement;
			if (element == null) throw new Error("cannot handle mouse movement because the element is missing! what are you doing!!!");

			this._rotateLeft( _twoPI * this._rotateDelta.x / element.clientHeight ); // yes, height

			this._rotateUp( _twoPI * this._rotateDelta.y / element.clientHeight );

			this._rotateStart.copy( this._rotateEnd );

			this.update();

		}

		/**
		 * @param {MouseEvent} event
		 */
		_handleMouseMoveDolly( event ) {

			this._dollyEnd.set( event.clientX, event.clientY );

			this._dollyDelta.subVectors( this._dollyEnd, this._dollyStart );

			if ( this._dollyDelta.y > 0 ) {

				this._dollyOut( this._getZoomScale( this._dollyDelta.y ) );

			} else if ( this._dollyDelta.y < 0 ) {

				this._dollyIn( this._getZoomScale( this._dollyDelta.y ) );

			}

			this._dollyStart.copy( this._dollyEnd );

			this.update();

		}

		/**
		 * @param {MouseEvent} event
		 */
		_handleMouseMovePan( event ) {

			this._panEnd.set( event.clientX, event.clientY );

			this._panDelta.subVectors( this._panEnd, this._panStart ).multiplyScalar( this.panSpeed );

			this._pan( this._panDelta.x, this._panDelta.y );

			this._panStart.copy( this._panEnd );

			this.update();

		}

		/**
		 * @param {{ clientX: number, clientY: number, deltaY: number }} event
		 */
		_handleMouseWheel( event ) {

			this._updateZoomParameters( event.clientX, event.clientY );

			if ( event.deltaY < 0 ) {

				this._dollyIn( this._getZoomScale( event.deltaY ) );

			} else if ( event.deltaY > 0 ) {

				this._dollyOut( this._getZoomScale( event.deltaY ) );

			}

			this.update();

		}

		/**
		 * @param {KeyboardEvent} event
		 */
		_handleKeyDown( event ) {
			if (this.domElement == null) throw new Error("cannot handle key presses because the element is missing! what are you doing!!!");

			let needsUpdate = false;

			switch ( event.code ) {

				case this.keys.UP:

					if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

						if ( this.enableRotate ) {

							this._rotateUp( _twoPI * this.keyRotateSpeed / this.domElement.clientHeight );

						}

					} else {

						if ( this.enablePan ) {

							this._pan( 0, this.keyPanSpeed );

						}

					}

					needsUpdate = true;
					break;

				case this.keys.BOTTOM:

					if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

						if ( this.enableRotate ) {

							this._rotateUp( - _twoPI * this.keyRotateSpeed / this.domElement.clientHeight );

						}

					} else {

						if ( this.enablePan ) {

							this._pan( 0, - this.keyPanSpeed );

						}

					}

					needsUpdate = true;
					break;

				case this.keys.LEFT:

					if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

						if ( this.enableRotate ) {

							this._rotateLeft( _twoPI * this.keyRotateSpeed / this.domElement.clientHeight );

						}

					} else {

						if ( this.enablePan ) {

							this._pan( this.keyPanSpeed, 0 );

						}

					}

					needsUpdate = true;
					break;

				case this.keys.RIGHT:

					if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

						if ( this.enableRotate ) {

							this._rotateLeft( - _twoPI * this.keyRotateSpeed / this.domElement.clientHeight );

						}

					} else {

						if ( this.enablePan ) {

							this._pan( - this.keyPanSpeed, 0 );

						}

					}

					needsUpdate = true;
					break;

			}

			if ( needsUpdate ) {

				// prevent the browser from scrolling on cursor keys
				event.preventDefault();

				this.update();

			}


		}

		/**
		 * @param {{ pointerId: number, pageX: number, pageY: number }} event
		 */
		_handleTouchStartRotate( event ) {

			if ( this._pointers.length === 1 ) {

				this._rotateStart.set( event.pageX, event.pageY );

			} else {

				const position = this._getSecondPointerPosition( event );

				const x = 0.5 * ( event.pageX + position.x );
				const y = 0.5 * ( event.pageY + position.y );

				this._rotateStart.set( x, y );

			}

		}

		/**
		 * @param {{ pointerId: number, pageX: number, pageY: number }} event
		 */
		_handleTouchStartPan( event ) {

			if ( this._pointers.length === 1 ) {

				this._panStart.set( event.pageX, event.pageY );

			} else {

				const position = this._getSecondPointerPosition( event );

				const x = 0.5 * ( event.pageX + position.x );
				const y = 0.5 * ( event.pageY + position.y );

				this._panStart.set( x, y );

			}

		}

		/**
		 * @param {{ pointerId: number, pageX: number, pageY: number }} event
		 */
		_handleTouchStartDolly( event ) {

			const position = this._getSecondPointerPosition( event );

			const dx = event.pageX - position.x;
			const dy = event.pageY - position.y;

			const distance = Math.sqrt( dx * dx + dy * dy );

			this._dollyStart.set( 0, distance );

		}

		/**
		 * @param {{ pointerId: number, pageX: number, pageY: number }} event
		 */
		_handleTouchStartDollyPan( event ) {

			if ( this.enableZoom ) this._handleTouchStartDolly( event );

			if ( this.enablePan ) this._handleTouchStartPan( event );

		}

		/**
		 * @param {{ pointerId: number, pageX: number, pageY: number }} event
		 */
		_handleTouchStartDollyRotate( event ) {

			if ( this.enableZoom ) this._handleTouchStartDolly( event );

			if ( this.enableRotate ) this._handleTouchStartRotate( event );

		}

		/**
		 * @param {PointerEvent} event
		 */
		_handleTouchMoveRotate( event ) {
			if (this.domElement == null) throw new Error("cannot handle touch movement because the element is missing! what are you doing!!!");

			if ( this._pointers.length == 1 ) {

				this._rotateEnd.set( event.pageX, event.pageY );

			} else {

				const position = this._getSecondPointerPosition( event );

				const x = 0.5 * ( event.pageX + position.x );
				const y = 0.5 * ( event.pageY + position.y );

				this._rotateEnd.set( x, y );

			}

			this._rotateDelta.subVectors( this._rotateEnd, this._rotateStart ).multiplyScalar( this.rotateSpeed );

			const element = this.domElement;

			this._rotateLeft( _twoPI * this._rotateDelta.x / element.clientHeight ); // yes, height

			this._rotateUp( _twoPI * this._rotateDelta.y / element.clientHeight );

			this._rotateStart.copy( this._rotateEnd );

		}

		/**
		 * @param {PointerEvent} event
		 */
		_handleTouchMovePan( event ) {

			if ( this._pointers.length === 1 ) {

				this._panEnd.set( event.pageX, event.pageY );

			} else {

				const position = this._getSecondPointerPosition( event );

				const x = 0.5 * ( event.pageX + position.x );
				const y = 0.5 * ( event.pageY + position.y );

				this._panEnd.set( x, y );

			}

			this._panDelta.subVectors( this._panEnd, this._panStart ).multiplyScalar( this.panSpeed );

			this._pan( this._panDelta.x, this._panDelta.y );

			this._panStart.copy( this._panEnd );

		}

		/**
		 * @param {PointerEvent} event
		 */
		_handleTouchMoveDolly( event ) {

			const position = this._getSecondPointerPosition( event );

			const dx = event.pageX - position.x;
			const dy = event.pageY - position.y;

			const distance = Math.sqrt( dx * dx + dy * dy );

			this._dollyEnd.set( 0, distance );

			this._dollyDelta.set( 0, Math.pow( this._dollyEnd.y / this._dollyStart.y, this.zoomSpeed ) );

			this._dollyOut( this._dollyDelta.y );

			this._dollyStart.copy( this._dollyEnd );

			const centerX = ( event.pageX + position.x ) * 0.5;
			const centerY = ( event.pageY + position.y ) * 0.5;

			this._updateZoomParameters( centerX, centerY );

		}

		/**
		 * @param {PointerEvent} event
		 */
		_handleTouchMoveDollyPan( event ) {

			if ( this.enableZoom ) this._handleTouchMoveDolly( event );

			if ( this.enablePan ) this._handleTouchMovePan( event );

		}

		/**
		 * @param {PointerEvent} event
		 */
		_handleTouchMoveDollyRotate( event ) {

			if ( this.enableZoom ) this._handleTouchMoveDolly( event );

			if ( this.enableRotate ) this._handleTouchMoveRotate( event );

		}

		// pointers

		/**
		 * @param {PointerEvent} event
		 */
		_addPointer( event ) {

			this._pointers.push( event.pointerId );

		}

		/**
		 * @param {PointerEvent} event
		 */
		_removePointer( event ) {

			delete this._pointerPositions[ event.pointerId ];

			for ( let i = 0; i < this._pointers.length; i ++ ) {

				if ( this._pointers[ i ] == event.pointerId ) {

					this._pointers.splice( i, 1 );
					return;

				}

			}

		}

		/**
		 * @param {PointerEvent} event
		 */
		_isTrackingPointer( event ) {

			for ( let i = 0; i < this._pointers.length; i ++ ) {

				if ( this._pointers[ i ] == event.pointerId ) return true;

			}

			return false;

		}

		/**
		 * @param {{ pointerId: number, pageX: number, pageY: number }} event
		 */
		_trackPointer( event ) {

			let position = this._pointerPositions[ event.pointerId ];

			if ( position === undefined ) {

				position = new THREE.Vector2();
				this._pointerPositions[ event.pointerId ] = position;

			}

			position.set( event.pageX, event.pageY );

		}

		/**
		 * @param {{ pointerId: number, pageX: number, pageY: number }} event
		 */
		_getSecondPointerPosition( event ) {

			const pointerId = ( event.pointerId === this._pointers[ 0 ] ) ? this._pointers[ 1 ] : this._pointers[ 0 ];

			return this._pointerPositions[ pointerId ];

		}

		//

		/**
		 * @param {WheelEvent} event
		 */
		_customWheelEvent( event ) {

			const mode = event.deltaMode;

			// minimal wheel event altered to meet delta-zoom demand
			const newEvent = {
				clientX: event.clientX,
				clientY: event.clientY,
				deltaY: event.deltaY,
			};

			switch ( mode ) {

				case 1: // LINE_MODE
					newEvent.deltaY *= 16;
					break;

				case 2: // PAGE_MODE
					newEvent.deltaY *= 100;
					break;

			}

			// detect if event was triggered by pinching
			if ( event.ctrlKey && ! this._controlActive ) {

				newEvent.deltaY *= 10;

			}

			return newEvent;

		}

		/**
		 * @param {PointerEvent} event
		 */
		onPointerDown( event ) {
			if (this.domElement == null) throw new Error("cannot handle pointer because the element is missing! what are you doing!!!");

			if ( this.enabled === false ) return;

			if ( this._pointers.length === 0 ) {

				this.domElement.setPointerCapture( event.pointerId );

				this.domElement.addEventListener( 'pointermove', this.onPointerMove.bind(this) );
				this.domElement.addEventListener( 'pointerup', this.bound.onPointerUp );

			}

			//

			if ( this._isTrackingPointer( event ) ) return;

			//

			this._addPointer( event );

			if ( event.pointerType === 'touch' ) {

				this.onTouchStart( event );

			} else {

				this.onMouseDown( event );

			}

		}

		/**
		 * @param {PointerEvent} event
		 */
		onPointerMove( event ) {

			if ( this.enabled === false ) return;

			if ( event.pointerType === 'touch' ) {

				this.onTouchMove( event );

			} else {

				this.onMouseMove( event );

			}

		}

		/**
		 * @param {PointerEvent} event
		 */
		onPointerUp( event ) {
			if (this.domElement == null) throw new Error("cannot handle pointer up because the element is missing! what are you doing!!!");

			this._removePointer( event );

			switch ( this._pointers.length ) {

				case 0:

					this.domElement.releasePointerCapture( event.pointerId );

					this.domElement.removeEventListener( 'pointermove', this.onPointerMove.bind(this) );
					this.domElement.removeEventListener( 'pointerup', this.bound.onPointerUp );

					this.dispatchEvent( _endEvent );

					this.state = _STATE.NONE;

					break;

				case 1:

					const pointerId = this._pointers[ 0 ];
					const position = this._pointerPositions[ pointerId ];

					// minimal placeholder event - allows state correction on pointer-up
					this.onTouchStart( { pointerId: pointerId, pageX: position.x, pageY: position.y } );

					break;

			}

		}

		/**
		 * @param {MouseEvent} event
		 */
		onMouseDown( event ) {

			let mouseAction;

			switch ( event.button ) {

				case 0:

					mouseAction = this.mouseButtons.LEFT;
					break;

				case 1:

					mouseAction = this.mouseButtons.MIDDLE;
					break;

				case 2:

					mouseAction = this.mouseButtons.RIGHT;
					break;

				default:

					mouseAction = - 1;

			}

			switch ( mouseAction ) {

				case THREE.MOUSE.DOLLY:

					if ( this.enableZoom === false ) return;

					this._handleMouseDownDolly( event );

					this.state = _STATE.DOLLY;

					break;

				case THREE.MOUSE.ROTATE:

					if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

						if ( this.enablePan === false ) return;

						this._handleMouseDownPan( event );

						this.state = _STATE.PAN;

					} else {

						if ( this.enableRotate === false ) return;

						this._handleMouseDownRotate( event );

						this.state = _STATE.ROTATE;

					}

					break;

				case THREE.MOUSE.PAN:

					if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

						if ( this.enableRotate === false ) return;

						this._handleMouseDownRotate( event );

						this.state = _STATE.ROTATE;

					} else {

						if ( this.enablePan === false ) return;

						this._handleMouseDownPan( event );

						this.state = _STATE.PAN;

					}

					break;

				default:

					this.state = _STATE.NONE;

			}

			if ( this.state !== _STATE.NONE ) {

				this.dispatchEvent( _startEvent );

			}

		}

		/**
		 * @param {MouseEvent} event
		 */
		onMouseMove( event ) {

			switch ( this.state ) {

				case _STATE.ROTATE:

					if ( this.enableRotate === false ) return;

					this._handleMouseMoveRotate( event );

					break;

				case _STATE.DOLLY:

					if ( this.enableZoom === false ) return;

					this._handleMouseMoveDolly( event );

					break;

				case _STATE.PAN:

					if ( this.enablePan === false ) return;

					this._handleMouseMovePan( event );

					break;

			}

		}

		/**
		 * @param {WheelEvent} event
		 */
		onMouseWheel( event ) {

			if ( this.enabled === false || this.enableZoom === false || this.state !== _STATE.NONE ) return;

			event.preventDefault();

			this.dispatchEvent( _startEvent );

			this._handleMouseWheel( this._customWheelEvent( event ) );

			this.dispatchEvent( _endEvent );

		}

		/**
		 * @param {Event} event
		 */
		onKeyDown( event ) {

			if ( this.enabled === false ) return;

			if (! (event instanceof KeyboardEvent)) throw new Error("onKeyDown somehow got a non-keyboard event. you should stop breaking things.");

			this._handleKeyDown( event );

		}

		/**
		 * @param {{ pointerId: number, pageX: number, pageY: number }} event
		 */
		onTouchStart( event ) {

			this._trackPointer( event );

			switch ( this._pointers.length ) {

				case 1:

					switch ( this.touches.ONE ) {

						case THREE.TOUCH.ROTATE:

							if ( this.enableRotate === false ) return;

							this._handleTouchStartRotate( event );

							this.state = _STATE.TOUCH_ROTATE;

							break;

						case THREE.TOUCH.PAN:

							if ( this.enablePan === false ) return;

							this._handleTouchStartPan( event );

							this.state = _STATE.TOUCH_PAN;

							break;

						default:

							this.state = _STATE.NONE;

					}

					break;

				case 2:

					switch ( this.touches.TWO ) {

						case THREE.TOUCH.DOLLY_PAN:

							if ( this.enableZoom === false && this.enablePan === false ) return;

							this._handleTouchStartDollyPan( event );

							this.state = _STATE.TOUCH_DOLLY_PAN;

							break;

						case THREE.TOUCH.DOLLY_ROTATE:

							if ( this.enableZoom === false && this.enableRotate === false ) return;

							this._handleTouchStartDollyRotate( event );

							this.state = _STATE.TOUCH_DOLLY_ROTATE;

							break;

						default:

							this.state = _STATE.NONE;

					}

					break;

				default:

					this.state = _STATE.NONE;

			}

			if ( this.state !== _STATE.NONE ) {

				this.dispatchEvent( _startEvent );

			}

		}

		/**
		 * @param {PointerEvent} event
		 */
		onTouchMove( event ) {

			this._trackPointer( event );

			switch ( this.state ) {

				case _STATE.TOUCH_ROTATE:

					if ( this.enableRotate === false ) return;

					this._handleTouchMoveRotate( event );

					this.update();

					break;

				case _STATE.TOUCH_PAN:

					if ( this.enablePan === false ) return;

					this._handleTouchMovePan( event );

					this.update();

					break;

				case _STATE.TOUCH_DOLLY_PAN:

					if ( this.enableZoom === false && this.enablePan === false ) return;

					this._handleTouchMoveDollyPan( event );

					this.update();

					break;

				case _STATE.TOUCH_DOLLY_ROTATE:

					if ( this.enableZoom === false && this.enableRotate === false ) return;

					this._handleTouchMoveDollyRotate( event );

					this.update();

					break;

				default:

					this.state = _STATE.NONE;

			}

		}

		/**
		 * @param {MouseEvent} event
		 */
		onContextMenu( event ) {

			if ( this.enabled === false ) return;

			event.preventDefault();

		}

		/**
		 * @param {Event} event
		 */
		interceptControlDown( event ) {

			if (! (event instanceof KeyboardEvent)) throw new Error("interceptControlDown somehow got a non-keyboard event. you should stop breaking things.");
			if (this.domElement == null) throw new Error("you need to set the element for orbit controls");

			if ( event.key === 'Control' ) {

				this._controlActive = true;

				const document = this.domElement.getRootNode(); // offscreen canvas compatibility

				document.addEventListener( 'keyup', this.bound.interceptControlUp, { passive: true, capture: true } );

			}

		}

		/**
		 * @param {Event} event
		 */
		interceptControlUp( event ) {

			if (! (event instanceof KeyboardEvent)) throw new Error("interceptControlUp somehow got a non-keyboard event. you should stop breaking things.");
			if (this.domElement == null) throw new Error("you need to set the element for orbit controls");

			if ( event.key === 'Control' ) {

				this._controlActive = false;

				const document = this.domElement.getRootNode(); // offscreen canvas compatibility

				document.removeEventListener( 'keyup', this.bound.interceptControlUp, { capture: true } );

			}

		}

	}

	return OrbitControls
})();